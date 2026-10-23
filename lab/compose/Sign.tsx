import { useEffect, useRef } from 'react';
import { createMarquee, type Marquee, scatter } from '@/index.js';
import type { Hardware } from './hardware.js';
import { compose, playing } from './store.js';
import './Sign.css';

/** The sign the composition plays on, with the hardware it is built from. */
export function Sign({ hardware }: { hardware: Hardware }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sign = useRef<Marquee | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const m = createMarquee(canvas.current, { program: playing, effects: compose.get().effects });
    sign.current = m;
    compose.attach(m);
    return () => {
      compose.attach(null);
      sign.current = null;
      m.destroy();
    };
  }, []);

  useEffect(() => {
    const m = sign.current;
    if (!m) return;
    m.setFade(hardware.fade);
    m.setGhost(hardware.ghost);
    m.setDefects(scatter(m.board, hardware.defects, hardware.defects.seed));
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
