import { useEffect, useRef } from 'react';
import {
  type Border,
  createMarquee,
  type EffectSpec,
  type GridName,
  type Marquee,
  type Scene,
  scatter,
} from '@/index.js';
import type { Hardware } from './hardware.js';
import './Sign.css';

/** How the hardware's border lights its bulbs; with none, nothing is asked of a sign with none. */
const borderOf = ({ border }: Hardware): Border => ({
  bulbs: border.bulbs === 'none' ? 'unlit' : (border.bulbs as Border['bulbs']),
  beat: border.beat,
  dim: border.dim,
});

/** Gives a sign the hardware's lights, its defects scattered over that sign's own dots. */
function equip(m: Marquee, hardware: Hardware): void {
  m.setBorder(borderOf(hardware));
  m.setFade(hardware.fade);
  m.setGhost(hardware.ghost);
  m.setDefects(scatter(m.board, hardware.defects, hardware.defects.seed));
}

/**
 * A sign built from `hardware` playing `program`, handed to `onSign` as it is made and as null as
 * it goes. A new size or border builds a new sign; carrying the pass over to it is `onSign`'s job.
 */
export function Sign({
  hardware,
  program,
  effects,
  onSign,
}: {
  hardware: Hardware;
  /** Read by the sign each pass. */
  program: () => readonly Scene[];
  /** Read as each sign is built; later changes are the owner's to give the sign. */
  effects: () => Readonly<Record<string, EffectSpec>>;
  onSign: (m: Marquee | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sign = useRef<Marquee | null>(null);
  const latest = useRef({ hardware, program, effects, onSign });
  latest.current = { hardware, program, effects, onSign };
  const { cols, rows, grid } = hardware.size;
  // A border coming or going changes the sign's margin, so it builds a new sign as a size does.
  const bordered = hardware.border.bulbs !== 'none';

  useEffect(() => {
    if (!canvas.current) return;
    const { hardware: h, program: p, effects: e, onSign: handTo } = latest.current;
    const m = createMarquee(canvas.current, {
      cols,
      rows,
      grid: grid as GridName,
      border: bordered && borderOf(h),
      program: p,
      effects: e(),
    });
    equip(m, h);
    sign.current = m;
    handTo(m);
    return () => {
      handTo(null);
      sign.current = null;
      m.destroy();
    };
  }, [cols, rows, grid, bordered]);

  useEffect(() => {
    if (sign.current) equip(sign.current, hardware);
  }, [hardware]);

  return (
    <div className="compose-sign">
      {/* The canvas sizes itself to its parent's client box, padding included, so the padding sits outside it. */}
      <div className="compose-sign-box">
        <canvas id="sign" ref={canvas} />
      </div>
    </div>
  );
}
