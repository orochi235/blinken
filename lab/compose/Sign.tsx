import { useEffect, useRef } from 'react';
import {
  createMarquee,
  type EffectSpec,
  type GridName,
  type Housing,
  type Marquee,
  type Scene,
} from '@/index.js';
import { type Choice, drawWith } from '../backend.js';
import { useGpu } from '../gpu.js';
import { borderOf, equip, type Hardware } from './sign-hardware.js';
import './Sign.css';

/**
 * A sign built from `hardware` playing `program`, handed to `onSign` as it is made and as null as
 * it goes. A new size, border, housing or backend builds a new sign; carrying the pass over to it is
 * `onSign`'s job. None is built until the page's WebGPU request settles.
 */
export function Sign({
  hardware,
  program,
  effects,
  onSign,
  choice = 'auto',
}: {
  hardware: Hardware;
  /** Read by the sign each pass. */
  program: () => readonly Scene[];
  /** Read as each sign is built; later changes are the owner's to give the sign. */
  effects: () => Readonly<Record<string, EffectSpec>>;
  onSign: (m: Marquee | null) => void;
  choice?: Choice;
}) {
  const handle = useGpu();
  const canvas = useRef<HTMLCanvasElement>(null);
  const sign = useRef<Marquee | null>(null);
  const latest = useRef({ hardware, program, effects, onSign });
  latest.current = { hardware, program, effects, onSign };
  const { cols, rows, grid } = hardware.size;
  // A border coming or going changes the sign's margin, so it builds a new sign as a size does.
  const bordered = hardware.border.bulbs !== 'none';
  const housing = hardware.case.housing as Housing;

  useEffect(() => {
    if (!canvas.current || handle === undefined) return;
    const { hardware: h, program: p, effects: e, onSign: handTo } = latest.current;
    const m = createMarquee(canvas.current, {
      cols,
      rows,
      grid: grid as GridName,
      border: bordered && borderOf(h),
      housing,
      program: p,
      effects: e(),
      ...drawWith(choice, handle),
    });
    equip(m, h);
    sign.current = m;
    handTo(m);
    return () => {
      handTo(null);
      sign.current = null;
      m.destroy();
    };
  }, [cols, rows, grid, bordered, housing, choice, handle]);

  useEffect(() => {
    if (sign.current) equip(sign.current, hardware);
  }, [hardware]);

  return (
    <div className="compose-sign">
      {/* The canvas sizes itself to its parent's client box, padding included, so the padding sits outside it. */}
      <div className="compose-sign-box">
        {/* A canvas that drew with one backend can't give another its context, so each gets its own. */}
        <canvas key={choice} id="sign" ref={canvas} />
      </div>
    </div>
  );
}
