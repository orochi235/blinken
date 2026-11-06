import { patch } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import type { Led, Pose, Subject } from '@/board.js';
import { createPanel } from '@/readout/panel.js';
import { insideOf } from '@/readout/surface.js';
import { TYPES } from '@/readout/types/index.js';
import type { Ticker } from '@/ticker.js';

/** A ticker stepped by hand. */
function manual(): Ticker & { step(ms: number): void } {
  const fns = new Set<(now: number) => void>();
  let now = 0;
  return {
    add(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    get size() {
      return fns.size;
    },
    step(ms) {
      now += ms;
      for (const fn of fns) fn(now);
    },
  };
}

const slotOf = (name: string) => TYPES.seven.cell.lights.findIndex((l) => l.name === name);

function setUp() {
  const ticker = manual();
  const s = createPanel({} as HTMLCanvasElement, { draw: false, ticker });
  const inside = insideOf(s);
  if (!inside) throw new Error('no inside');
  const dot = (x: number, y: number) => {
    const b = inside.layout().board;
    return b.dots[y * b.cols + x] as Led;
  };
  const lit = (x: number, y: number) => inside.mix.probe(dot(x, y)).lit;
  return { s, ticker, inside, dot, lit };
}

describe('a panel of readouts', () => {
  it('lights the segments of its value', () => {
    const { s, ticker, lit } = setUp();
    s.readout({ type: 'seven', cells: 2, value: '12', align: 'left' });
    ticker.step(16);
    expect(lit(0, slotOf('b'))).toBe(1);
    expect(lit(0, slotOf('c'))).toBe(1);
    expect(lit(0, slotOf('a'))).toBe(0);
    expect(lit(1, slotOf('g'))).toBe(1);
    s.destroy();
  });

  it('keeps a readout’s value when another is added, and drops a destroyed one’s lights', () => {
    const { s, ticker, inside, lit } = setUp();
    const one = s.readout({ type: 'seven', cells: 1, value: '1' });
    ticker.step(16);
    const two = s.readout({ type: 'nixie', cells: 1, value: 8 });
    ticker.step(16);
    expect(lit(0, slotOf('b'))).toBe(1);
    const base = inside.layout().spots[1]?.base as number;
    const eight = TYPES.nixie.cell.lights.findIndex((l) => l.name === '8');
    expect(lit(0, base + eight)).toBe(1);
    one.destroy();
    ticker.step(16);
    expect(inside.layout().spots).toHaveLength(1);
    expect(lit(0, eight)).toBe(1);
    two.set(3);
    ticker.step(16);
    expect(lit(0, eight)).toBe(0);
    s.destroy();
  });

  it('carries an effect cued on its mix to the segments it covers', () => {
    const { s, ticker, inside, dot } = setUp();
    s.readout({ type: 'seven', cells: 1, value: '8' });
    ticker.step(16);
    const seg = dot(0, slotOf('a'));
    inside.mix.cue({
      name: 'dim',
      patch: patch<Subject, Pose>(1000, () => ({ gain: 0.25 }), { writes: ['gain'] }),
      subjects: [seg],
      loop: true,
    });
    ticker.step(16);
    expect(inside.mix.probe(seg).gain).toBeCloseTo(0.25, 6);
    s.destroy();
  });

  it('shows text from its first cells and numbers from their last', () => {
    const { s, ticker, lit } = setUp();
    s.readout({ type: 'seven', cells: 2, value: 1234 });
    ticker.step(16);
    // 3 4: the 4 lights f, and the 3 doesn't.
    expect(lit(0, slotOf('f'))).toBe(0);
    expect(lit(1, slotOf('f'))).toBe(1);
    s.destroy();
  });
});

describe('an idle surface', () => {
  it('draws while its lights settle from a change, then stops until the next', () => {
    const ticker = manual();
    let frames = 0;
    // Sized, as a real canvas is: a fit from no size is NaN, which reads as moving every frame.
    const canvas = { clientWidth: 400, clientHeight: 200 } as HTMLCanvasElement;
    const s = createPanel(canvas, {
      draw: false,
      ticker,
      onFrame: () => {
        frames++;
      },
    });
    const r = s.readout({ type: 'seven', cells: 2, value: 12 });
    for (let k = 0; k < 200; k++) ticker.step(16);
    const settled = frames;
    expect(settled).toBeGreaterThan(10);
    expect(settled).toBeLessThan(80);
    for (let k = 0; k < 100; k++) ticker.step(16);
    expect(frames).toBe(settled);
    r.set(34);
    for (let k = 0; k < 100; k++) ticker.step(16);
    expect(frames).toBeGreaterThan(settled);
    s.destroy();
  });
});
