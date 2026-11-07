import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {
  createOverlay,
  createTransition,
  type Readout,
  type Surface,
  type Transition,
  type TransitionRecipe,
  TYPES,
} from '@/index.js';
import { IconButton } from '../compose/IconButton.js';
import type { Stage as StageSettings } from './store.js';

/** The moments the filmstrip holds, from the old value to the new. */
const FRAMES = Array.from({ length: 11 }, (_, i) => i / 10);
/** How long the stage holds each end of a change before playing it again, ms. */
const HOLD = { before: 500, after: 900 };

/** `inner` held at `t`, for as long as nothing else is set. */
const heldAt = (inner: Transition, t: number): Transition => ({
  name: 'held',
  ms: 1e9,
  start(c) {
    const frames = inner.start(c);
    return () => frames(t);
  },
});

/** Sets `r` to `from` at once, then to `to` by `transition`. */
function change(r: Readout, from: string, to: string, transition: Transition) {
  r.setTransition('cut');
  r.set(from);
  r.setTransition(transition);
  r.set(to);
}

/**
 * The open transition played on a readout of the stage's type, over and over or held where the
 * scrubber is, above a filmstrip of it held at each tenth of the way.
 */
export function Stage({ recipe, stage }: { recipe: TransitionRecipe; stage: StageSettings }) {
  const transition = useMemo(() => createTransition(recipe), [recipe]);
  const big = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const surface = useRef<Surface | null>(null);
  const readouts = useRef<{ big: Readout; frames: Readout[] } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [at, setAt] = useState(0);
  const { width, height } = TYPES[stage.type].cell;
  const aspect = (width * stage.cells) / height;

  useEffect(() => {
    const overlay = createOverlay({ fade: { rise: 10, fall: 20 } });
    surface.current = overlay;
    return () => {
      overlay.destroy();
      surface.current = null;
    };
  }, []);

  // The readouts are made afresh for each type, cell count and color.
  useEffect(() => {
    const overlay = surface.current;
    if (!overlay || !big.current || !strip.current) return;
    const options = {
      type: stage.type,
      cells: stage.cells,
      select: false,
      color: Number.parseInt(stage.color.slice(1), 16),
    };
    const slots = [...strip.current.querySelectorAll<HTMLElement>('.tr-frame-slot')];
    const made = {
      big: overlay.readout({ ...options, follow: big.current }),
      frames: slots.map((follow) => overlay.readout({ ...options, follow })),
    };
    readouts.current = made;
    return () => {
      made.big.destroy();
      for (const r of made.frames) r.destroy();
      readouts.current = null;
    };
  }, [stage.type, stage.cells, stage.color]);

  // The filmstrip follows every change to the recipe and the stage.
  useEffect(() => {
    const made = readouts.current;
    if (!made) return;
    made.frames.forEach((r, i) => {
      change(r, stage.from, stage.to, heldAt(transition, FRAMES[i] ?? 0));
    });
  }, [transition, stage]);

  // Paused, the stage holds the moment the scrubber is at.
  useEffect(() => {
    const made = readouts.current;
    if (made && !playing) change(made.big, stage.from, stage.to, heldAt(transition, at));
  }, [playing, at, transition, stage]);

  // Playing, it holds the old value, plays the change, holds the new, and starts again.
  useEffect(() => {
    const made = readouts.current;
    if (!made || !playing) return;
    const ms = Math.max(1, transition.ms);
    const cycle = HOLD.before + ms + HOLD.after;
    let began = performance.now();
    let started = false;
    made.big.setTransition('cut');
    made.big.set(stage.from);
    let frame = 0;
    const tick = (now: number) => {
      if (now - began >= cycle) {
        began = now;
        started = false;
        made.big.setTransition('cut');
        made.big.set(stage.from);
      }
      const into = now - began - HOLD.before;
      if (!started && into >= 0) {
        change(made.big, stage.from, stage.to, transition);
        started = true;
      }
      setAt(Math.min(1, Math.max(0, into / ms)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, transition, stage]);

  return (
    <div className="tr-stage" style={{ '--aspect': String(aspect) } as CSSProperties}>
      <div className="tr-big" ref={big} />
      <div className="tr-transport">
        <IconButton
          glyph={playing ? 'pause' : 'play'}
          label={playing ? 'pause' : 'play'}
          onClick={() => setPlaying(!playing)}
        />
        <input
          type="range"
          className="tr-scrub"
          min={0}
          max={1}
          step={0.005}
          value={at}
          aria-label="moment"
          onChange={(e) => {
            setPlaying(false);
            setAt(Number(e.target.value));
          }}
        />
        <output className="tr-at">{`t ${at.toFixed(2)}`}</output>
      </div>
      <div className="tr-strip" ref={strip}>
        {FRAMES.map((t) => (
          <div key={t} className="tr-frame">
            <span className="tr-frame-t">{t.toFixed(1)}</span>
            <div className="tr-frame-slot" />
          </div>
        ))}
      </div>
    </div>
  );
}
