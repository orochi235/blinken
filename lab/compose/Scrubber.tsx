import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from 'react';
import { cssOf, type Pass, type PassScene } from '@/index.js';
import { sceneAt, watchPass } from './clock.js';
import type { Player } from './player.js';
import './Scrubber.css';

/** How far an arrow key moves the pass. */
const STEP_MS = 250;

const spansOf = (pass: Pass | null) => pass?.scenes ?? [];
const keyOf = (scenes: readonly PassScene[]) => scenes.map((s) => `${s.scene}:${s.ms}`).join(' ');
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** What a scene of the pass shows on the track: its message, in its color. */
export type SceneLook = (s: PassScene) => { text: string; hex: number } | undefined;

/** Where each scene's parts hand over to one another, as fractions of the pass. */
function phaseLines(scenes: readonly PassScene[]): number[] {
  const last = scenes.at(-1);
  const length = last ? last.start + last.ms : 0;
  if (length <= 0) return [];
  const at = new Set<number>();
  for (const s of scenes)
    for (const p of Object.values(s.parts)) {
      if (p.ms <= 0) continue;
      for (const edge of [p.start, p.start + p.ms])
        if (edge > s.start && edge < s.start + s.ms) at.add(edge / length);
    }
  return [...at].sort((a, b) => a - b);
}

/** The playhead as a screen reader says it: how far in, of how long, and in which scene. */
function valueText(pass: Pass | null, look: SceneLook): string {
  if (!pass) return 'nothing playing';
  const now = sceneAt(pass);
  const text = now ? look(now)?.text : undefined;
  const where = `${seconds(pass.at)} of ${seconds(pass.length)}`;
  return text ? `${where}, in ${text}` : where;
}

/**
 * The pass playing now, its scenes end to end, with a playhead on the sign's own clock. A press
 * holds the sign at that moment and follows a drag; letting go plays on from there. With `phases`,
 * a dotted line marks where each scene's parts (enter, active, exit) meet.
 */
export function Scrubber({
  player,
  look,
  phases = false,
}: {
  player: Player;
  look: SceneLook;
  phases?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [scenes, setScenes] = useState<readonly PassScene[]>([]);
  const held = useRef(false);
  const length = useRef(0);
  const looks = useRef(look);
  looks.current = look;

  useEffect(
    () =>
      watchPass(player, (pass) => {
        const next = spansOf(pass);
        setScenes((was) => (keyOf(was) === keyOf(next) ? was : next));
        length.current = pass?.length ?? 0;
        const at = pass && pass.length > 0 ? pass.at / pass.length : 0;
        const el = track.current;
        if (!el) return;
        el.style.setProperty('--at', at.toFixed(5));
        el.setAttribute('aria-valuenow', String(Math.round(pass?.at ?? 0)));
        el.setAttribute('aria-valuemax', String(Math.round(length.current)));
        el.setAttribute('aria-valuetext', valueText(pass, looks.current));
      }),
    [player],
  );

  useEffect(() => {
    track.current?.style.setProperty('--spans', scenes.map((s) => `${s.ms}fr`).join(' ') || '1fr');
  }, [scenes]);

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
      title="Where the sign is in its pass. Press or drag to hold it at a moment, and let go to play on from there; ← and → step a quarter second."
      aria-valuemin={0}
      aria-valuenow={0}
      onKeyDown={(e) => {
        const by = { ArrowLeft: -STEP_MS, ArrowRight: STEP_MS }[e.key];
        const pass = player.pass();
        if (by === undefined || !pass) return;
        e.preventDefault();
        player.seek(pass.at + by);
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        player.seek(msAt(e), true);
      }}
      onPointerMove={(e) => {
        if (held.current) player.seek(msAt(e), true);
      }}
      onPointerUp={(e) => {
        if (!held.current) return;
        held.current = false;
        player.seek(msAt(e));
      }}
      onPointerCancel={() => {
        if (!held.current) return;
        held.current = false;
        const pass = player.pass();
        if (pass) player.seek(pass.at);
      }}
    >
      {scenes.map((s) => (
        <span
          key={`${s.scene}:${s.start}`}
          className="compose-scrubber-scene"
          title={look(s)?.text}
        >
          {look(s)?.text}
        </span>
      ))}
      {/* The same scenes in their own colors, shown only left of the playhead. */}
      <div className="compose-scrubber-played" aria-hidden="true">
        {scenes.map((s) => {
          const scene = look(s);
          return (
            <span
              key={`${s.scene}:${s.start}`}
              className="compose-scrubber-scene"
              // A scene's own color has no class to name it; the custom property is all that varies.
              style={{ '--scene-color': cssOf(scene?.hex ?? 0) } as CSSProperties}
            >
              {scene?.text}
            </span>
          );
        })}
      </div>
      {phases &&
        phaseLines(scenes).map((x) => (
          <span
            key={x}
            className="compose-scrubber-phase"
            aria-hidden="true"
            // Where the line falls is the one thing that varies.
            style={{ '--x': x.toFixed(5) } as CSSProperties}
          />
        ))}
      <span className="compose-scrubber-head" aria-hidden="true" />
    </div>
  );
}
