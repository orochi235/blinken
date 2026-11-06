import { describe, expect, it } from 'vitest';
import { createMarquee } from '@/marquee.js';
import { awayGaps } from '@/ticker.js';

describe('awayGaps', () => {
  it('leaves out one long gap among short ones, and a backward one', () => {
    const away = awayGaps();
    expect([16, 16, 5000, 16, -3].map(away)).toEqual([false, false, true, false, true]);
  });

  it('counts long gaps in a row as a slow pace, after the first', () => {
    const away = awayGaps();
    expect([330, 330, 330, 500].map(away)).toEqual([true, false, false, false]);
  });
});

describe('a sign that draws slower than 4 frames a second', () => {
  it('still plays its pass', () => {
    const fns: ((now: number) => void)[] = [];
    const m = createMarquee({} as HTMLCanvasElement, {
      draw: false,
      ticker: {
        add(fn) {
          fns.push(fn);
          return () => {};
        },
        size: 0,
      },
      program: [{ effect: 'hold', text: 'HI', hex: 0xff0000 }],
    });
    const t0 = performance.now();
    for (let k = 1; k <= 10; k++) for (const fn of fns) fn(t0 + k * 330);
    expect(m.pass()?.at).toBeGreaterThan(2000);
    m.destroy();
  });
});
