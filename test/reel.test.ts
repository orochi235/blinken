import { describe, expect, it } from 'vitest';
import { signColumns } from '@/draw.js';
import type { FACE_NAMES } from '@/faces.js';
import { createMarquee } from '@/marquee.js';
import type { Ticker } from '@/ticker.js';
import { exitOf, REST, reelOf } from '../lab/compose/reel.js';

/** The dots a borderless sign lights at `at` ms into a scroll of `text`. */
function litAt(
  text: string,
  face: (typeof FACE_NAMES)[number],
  cols: number,
  rows: number,
  at: number,
) {
  let tick = null as ((now: number) => void) | null;
  const ticker: Ticker = {
    add(fn) {
      tick = fn;
      return () => {};
    },
    size: 1,
  };
  const m = createMarquee({ id: '' } as HTMLCanvasElement, {
    cols,
    rows,
    border: false,
    draw: false,
    ticker,
    fade: { rise: 0, fall: 0 },
    program: [{ effect: 'scroll', text, face, hex: 0xffffff }],
  });
  m.seek(at, { hold: true });
  tick?.(16);
  const c = signColumns(m.board.dots.length);
  m.mix.pull(m.board.dots, c);
  const lit = m.board.dots.filter((_, i) => (c.lit[i] ?? 0) > 0.5).map((d) => `${d.x},${d.y}`);
  m.destroy();
  return lit;
}

describe('reelOf', () => {
  it('rests the name one column in, and loops on a frame that matches it', () => {
    for (const face of ['standard', 'slim', 'kenney-rocket'] as const) {
      const reel = reelOf(face, 90);
      const from = litAt(reel.text, face, 90, reel.rows, reel.from);
      const to = litAt(reel.text, face, 90, reel.rows, reel.to);
      expect(from.length, face).toBeGreaterThan(0);
      expect(Math.min(...from.map((d) => Number(d.split(',')[0]))), face).toBeGreaterThanOrEqual(
        REST,
      );
      expect(to, face).toEqual(from);
    }
  });

  it('leaves the reel on the frame it was showing, and ends on the resting name', () => {
    const face = 'standard';
    const reel = reelOf(face, 90);
    for (const at of [reel.from + 900, (reel.from + reel.to) / 2, reel.to - 300]) {
      const out = exitOf(face, 90, undefined, reel.text, at);
      expect(litAt(out.text, face, 90, reel.rows, at)).toEqual(
        litAt(reel.text, face, 90, reel.rows, at),
      );
      expect(litAt(out.text, face, 90, reel.rows, out.end)).toEqual(
        litAt(reel.text, face, 90, reel.rows, reel.from),
      );
    }
  });
});
