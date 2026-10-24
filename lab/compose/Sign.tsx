import { useEffect, useRef } from 'react';
import { createMarquee, type Marquee, scatter } from '@/index.js';
import type { Hardware } from './hardware.js';
import { compose, playing } from './store.js';
import './Sign.css';

/** Gives a sign the hardware's lights, its defects scattered over that sign's own dots. */
function equip(m: Marquee, hardware: Hardware): void {
  m.setFade(hardware.fade);
  m.setGhost(hardware.ghost);
  m.setDefects(scatter(m.board, hardware.defects, hardware.defects.seed));
}

/**
 * The sign the composition plays on, with the hardware it is built from. A new size builds a new
 * sign, which plays on from where the old one's pass stood.
 */
export function Sign({ hardware }: { hardware: Hardware }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sign = useRef<Marquee | null>(null);
  /** Where the last sign's pass stood when it was taken down. */
  const resume = useRef<number | undefined>(undefined);
  const latest = useRef(hardware);
  latest.current = hardware;
  const { cols, rows } = hardware.size;

  useEffect(() => {
    if (!canvas.current) return;
    const m = createMarquee(canvas.current, {
      cols,
      rows,
      program: playing,
      effects: compose.get().effects,
    });
    equip(m, latest.current);
    sign.current = m;
    compose.attach(m);
    if (resume.current !== undefined) m.seek(resume.current);
    return () => {
      resume.current = m.pass()?.at;
      compose.attach(null);
      sign.current = null;
      m.destroy();
    };
  }, [cols, rows]);

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
