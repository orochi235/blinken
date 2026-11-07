import { describe, expect, it } from 'vitest';
import type { Led } from '@/board.js';
import { createPanel } from '@/readout/panel.js';
import { insideOf } from '@/readout/surface.js';
import { type CellShown, type Change, TRANSITIONS } from '@/readout/transitions.js';
import { TYPES } from '@/readout/types/index.js';
import type { Ticker } from '@/ticker.js';

const spell = TYPES.sixteen.spell;
if (!spell) throw new Error('sixteen spells');
const cell = (ch: string): CellShown => ({ lit: spell.lights(ch), text: ch === ' ' ? '' : ch });
const shown = (s: string) => [...s].map(cell);

function change(from: string, to: string): Change {
  let n = 0;
  return {
    from: shown(from),
    to: shown(to),
    fromValue: from,
    toValue: to,
    spell,
    shownOf: (v) => shown(String(v)),
    random: () => (n++ * 0.618) % 1,
  };
}

/** Which of a cell's lights a frame lights fully, sorted. */
const litIn = (frame: (light: string) => number) =>
  TYPES.sixteen.cell.lights
    .map((l) => l.name)
    .filter((name) => frame(name) === 1)
    .sort();
const lightsOf = (ch: string) => [...spell.lights(ch)].sort();

describe('readout transitions', () => {
  it('every one starts at the old value and ends at the new', () => {
    for (const t of Object.values(TRANSITIONS)) {
      const frames = t.start(change('AB', 'CD'));
      expect(frames(1).map(litIn), t.name).toEqual([lightsOf('C'), lightsOf('D')]);
      if (t.name !== 'cut')
        expect(frames(0).map(litIn), t.name).toEqual([lightsOf('A'), lightsOf('B')]);
    }
  });

  it('fade keeps a light lit in both, and dims one lit only before', () => {
    const frames = TRANSITIONS.fade.start(change('E', 'F'))(0.25);
    const [only, both] = [lightsOf('E').find((l) => !spell.lights('F').has(l)), lightsOf('F')[0]];
    expect(frames[0]?.(both as string)).toBe(1);
    expect(frames[0]?.(only as string)).toBeCloseTo(0.75);
  });

  it('flap steps a cell through every character between, in order', () => {
    const frames = TRANSITIONS.flap.start(change('A', 'D'));
    const seen = Array.from({ length: 50 }, (_, i) => litIn(frames(i / 50)[0] ?? (() => 0)));
    const order = seen.filter((s, i) => i === 0 || s.join() !== seen[i - 1]?.join());
    expect(order).toEqual(['A', 'B', 'C', 'D'].map(lightsOf));
  });

  it('count passes through the numbers between, padded like the new value', () => {
    const c: Change = { ...change('0090', '0110'), shownOf: (v) => shown(String(v)) };
    const values: string[] = [];
    const frames = TRANSITIONS.count.start({
      ...c,
      shownOf: (v) => (values.push(String(v)), shown(String(v))),
    });
    frames(0.5);
    expect(values[0]).toMatch(/^01\d\d$|^00\d\d$/);
    expect(Number(values[0])).toBeGreaterThan(90);
    expect(Number(values[0])).toBeLessThan(110);
  });
});

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

describe('a readout with a transition', () => {
  it('shows values between while it counts, and the new value once done', () => {
    const ticker = manual();
    const s = createPanel({} as HTMLCanvasElement, { draw: false, ticker });
    const inside = insideOf(s);
    if (!inside) throw new Error('no inside');
    const r = s.readout({
      type: 'seven',
      cells: 1,
      value: 1,
      transition: 'count',
      transitionMs: 1000,
    });
    ticker.step(16);
    const g = TYPES.seven.cell.lights.findIndex((l) => l.name === 'g');
    const lit = () => {
      const b = inside.layout().board;
      return inside.mix.probe(b.dots[g * b.cols] as Led).lit;
    };
    expect(lit()).toBe(0);
    // 1 and 7 both leave g dark, and every digit between lights it.
    r.set(7);
    let between = false;
    for (let i = 0; i < 50; i++) {
      ticker.step(16);
      if (lit() === 1) between = true;
    }
    expect(between).toBe(true);
    ticker.step(1100);
    ticker.step(16);
    expect(r.value).toBe(7);
    expect(lit()).toBe(0);
    s.destroy();
  });
});
