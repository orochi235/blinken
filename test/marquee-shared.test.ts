import { describe, expect, it } from 'vitest';
import { createMarquee } from '@/marquee.js';

/** A ticker two signs share, which drops a frame when its sign lets go. */
const sharedTicker = () => {
  const fns = new Set<(now: number) => void>();
  return {
    ticker: {
      add(fn: (now: number) => void) {
        fns.add(fn);
        return () => fns.delete(fn);
      },
      get size() {
        return fns.size;
      },
    },
    step: (now: number) => {
      for (const fn of [...fns]) fn(now);
    },
  };
};

describe('two signs on one ticker', () => {
  it('destroying one leaves the other playing, and its follower falls back to its own color', () => {
    const { ticker, step } = sharedTicker();
    const opts = { draw: false, backend: '2d', ticker, cols: 10, rows: 7 } as const;
    const lead = createMarquee({} as HTMLCanvasElement, {
      ...opts,
      program: [{ effect: 'hold', text: 'A', hex: 0x00ff00 }],
    });
    const after = createMarquee({} as HTMLCanvasElement, {
      ...opts,
      follow: { source: () => lead, planes: ['color'] },
      program: [{ effect: 'hold', text: 'WW', hex: 0xff0000 }],
    });
    const own = createMarquee({} as HTMLCanvasElement, {
      ...opts,
      program: [{ effect: 'hold', text: 'WW', hex: 0xff0000 }],
    });
    for (let now = 0; now <= 800; now += 100) step(now);
    expect([...after.columns.tint]).toEqual([...lead.columns.tint]);

    lead.destroy();
    expect(ticker.size).toBe(2);
    const at = after.pass()?.at ?? 0;
    for (let now = 900; now <= 1600; now += 100) step(now);
    expect(after.pass()?.at ?? 0).toBeGreaterThan(at);
    expect([...after.columns.tint]).toEqual([...own.columns.tint]);

    for (const m of [after, own]) m.destroy();
    expect(ticker.size).toBe(0);
  });
});
