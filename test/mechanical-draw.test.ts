import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ticker } from '@/ticker.js';

const reels: { k: number; at: number; box: { x: number; y: number }; travel: number }[] = [];
vi.mock('@/mechanical/draw.js', () => ({
  drawReel: (
    _c: unknown,
    _glyphs: unknown,
    at: number,
    box: { x: number; y: number },
    _style: unknown,
    _scale: unknown,
    travel: number,
  ) => reels.push({ k: reels.length, at, box, travel }),
  drawFlap: () => {},
}));
const { createMechanical } = await import('@/mechanical/index.js');

/** A canvas whose 2D context records the colors it fills with. */
function canvas() {
  const fills: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (t, p) =>
        p in t
          ? Reflect.get(t, p)
          : p === 'fillRect'
            ? () => fills.push(String(ctx.fillStyle))
            : () => {},
      set: (t, p, v) => Reflect.set(t, p, v),
    },
  ) as { fillStyle?: string };
  const el = {
    getContext: () => ctx,
    clientWidth: 200,
    clientHeight: 50,
    width: 0,
    height: 0,
    setAttribute: () => {},
  } as unknown as HTMLCanvasElement;
  return { el, fills };
}

/** A ticker that runs on the faked clock. */
function manual(): Ticker & { step(ms: number): void } {
  const fns = new Set<(now: number) => void>();
  return {
    add(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    get size() {
      return fns.size;
    },
    step(ms) {
      vi.advanceTimersByTime(ms);
      for (const fn of [...fns]) fn(performance.now());
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance'] });
  reels.length = 0;
});
afterEach(() => vi.useRealTimers());

describe('a mechanical readout', () => {
  it('set again mid-turn turns on from where the reel stands, not the nearest glyph', () => {
    const ticker = manual();
    const m = createMechanical(canvas().el, { kind: 'reel', cells: 1, value: 0, ticker });
    m.set(5);
    ticker.step(200);
    const before = reels.at(-1)?.at ?? 0;
    expect(before % 1).not.toBe(0);
    m.set(9);
    ticker.step(1);
    expect(reels.at(-1)?.at).toBeCloseTo(before, 1);
    ticker.step(5000);
    expect((reels.at(-1)?.at ?? 0) % 10).toBeCloseTo(9);
    m.destroy();
  });

  it('hands a reel the glyphs it turned this frame: none at rest, more than one when fast', () => {
    const ticker = manual();
    const m = createMechanical(canvas().el, {
      kind: 'reel',
      cells: 1,
      value: 0,
      speed: 240,
      ticker,
    });
    expect(reels.at(-1)?.travel).toBe(0);
    m.set(9);
    let fastest = 0;
    for (let i = 0; i < 10; i++) {
      ticker.step(40);
      fastest = Math.max(fastest, reels.at(-1)?.travel ?? 0);
    }
    expect(fastest).toBeGreaterThan(1);
    m.setStyle({ ink: 'red' });
    expect(reels.at(-1)?.travel).toBe(0);
    m.destroy();
  });

  it('draws its housing, padding and gap from the readout, whatever one cell says', () => {
    const { el, fills } = canvas();
    const m = createMechanical(el, {
      kind: 'reel',
      cells: 2,
      style: { housing: '#123456' },
      each: { 0: { housing: '#ff0000', padding: 30, gap: 40 } as never },
      ticker: manual(),
    });
    expect(fills.at(-1)).toBe('#123456');
    const [a, b] = reels.slice(-2);
    expect(a?.box.y).toBe(4);
    expect((b?.box.x ?? 0) - (a?.box.x ?? 0)).toBeGreaterThan(3);
    expect((b?.box.x ?? 0) - (a?.box.x ?? 0)).toBeLessThan(120);
    m.destroy();
  });

  it('takes no cells', () => {
    expect(() => createMechanical(canvas().el, { kind: 'flap', cells: 0 }).destroy()).not.toThrow();
  });
});
