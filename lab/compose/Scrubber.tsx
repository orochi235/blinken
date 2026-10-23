import { type PointerEvent, useEffect, useRef, useState } from 'react';
import type { Pass, PassStep } from '@/index.js';
import { watchPass } from './clock.js';
import { compose, useCompose } from './store.js';
import './Scrubber.css';

/** How far an arrow key moves the pass. */
const STEP_MS = 250;

const spansOf = (pass: Pass | null) => pass?.steps ?? [];
const keyOf = (steps: readonly PassStep[]) => steps.map((s) => `${s.step}:${s.ms}`).join(' ');

/**
 * The pass playing now, its steps end to end, with a playhead on the sign's own clock. A press
 * holds the sign at that moment and follows a drag; letting go plays on from there.
 */
export function Scrubber() {
  const state = useCompose();
  const track = useRef<HTMLDivElement>(null);
  const [steps, setSteps] = useState<readonly PassStep[]>([]);
  const held = useRef(false);
  const length = useRef(0);

  useEffect(
    () =>
      watchPass((pass) => {
        const next = spansOf(pass);
        setSteps((was) => (keyOf(was) === keyOf(next) ? was : next));
        length.current = pass?.length ?? 0;
        const at = pass && pass.length > 0 ? pass.at / pass.length : 0;
        const el = track.current;
        if (!el) return;
        el.style.setProperty('--at', at.toFixed(5));
        el.setAttribute('aria-valuenow', String(Math.round(pass?.at ?? 0)));
        el.setAttribute('aria-valuemax', String(Math.round(length.current)));
      }),
    [],
  );

  useEffect(() => {
    track.current?.style.setProperty('--spans', steps.map((s) => `${s.ms}fr`).join(' ') || '1fr');
  }, [steps]);

  const msAt = (e: PointerEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    return (Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) || 0) * length.current;
  };

  return (
    <div
      ref={track}
      className="compose-scrubber"
      role="slider"
      tabIndex={0}
      aria-label="where the pass is"
      aria-valuemin={0}
      aria-valuenow={0}
      onKeyDown={(e) => {
        const by = { ArrowLeft: -STEP_MS, ArrowRight: STEP_MS }[e.key];
        const pass = compose.pass();
        if (by === undefined || !pass) return;
        e.preventDefault();
        compose.seek(pass.at + by);
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        compose.seek(msAt(e), true);
      }}
      onPointerMove={(e) => {
        if (held.current) compose.seek(msAt(e), true);
      }}
      onPointerUp={(e) => {
        if (!held.current) return;
        held.current = false;
        compose.seek(msAt(e));
      }}
      onPointerCancel={() => {
        held.current = false;
      }}
    >
      {steps.map((s) => {
        const index = compose.stepOf(s);
        return (
          <span
            key={`${s.step}:${s.start}`}
            className="compose-scrubber-step"
            title={state.program[index]?.text}
          >
            {state.program[index]?.text}
          </span>
        );
      })}
      <span className="compose-scrubber-head" aria-hidden="true" />
    </div>
  );
}
