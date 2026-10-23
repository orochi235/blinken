import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { rasterize } from '@/font.js';
import { MOVES, type Move, type MoveName } from '@/moves/index.js';
import { place } from '@/orders.js';
import { values } from '@/params.js';

const setting = {} as never;
const b = board(80, 7);
const at = place(b, rasterize('HI'));
const names = Object.keys(MOVES) as MoveName[];
const slotted = (slot: string) => names.filter((n) => MOVES[n].slot === slot);

/** The lit channel of every dot, `t` ms into a pass of the move. */
function litAt(m: Move, t: number, where = at, given: Record<string, unknown> = {}) {
  const p = { ...values(m), ...given } as never;
  const patch = m.patch(where, p);
  const phase = Math.min(1, t / m.length(where, p));
  return b.dots.map((d) => patch.at(phase, d, setting).lit ?? 0);
}

const shown = (left = at.left, text = at.text) =>
  b.dots.map((d) => (d.kind === 'dot' && d.row >= 0 && text.lit(d.x - left, d.row) ? 1 : 0));
const STEP = (MOVES['scroll-across'].params.step as { value: number }).value;
const length = (m: Move, where = at) => m.length(where, values(m));

describe('moves', () => {
  for (const name of slotted('enter')) {
    it(`${name} ends showing the message`, () => {
      const m = MOVES[name];
      const end = name === 'scroll-in' ? shown(0) : shown();
      expect(litAt(m, length(m))).toEqual(end);
    });
  }

  for (const name of slotted('enter').filter((n) => n !== 'unfold')) {
    for (const direction of ['left', 'right']) {
      it(`${name} shows no lit dots at phase 0 (${direction})`, () => {
        expect(litAt(MOVES[name], 0, at, { direction }).every((v) => v === 0)).toBe(true);
      });
    }
  }

  for (const name of slotted('exit')) {
    it(`${name} starts showing the message and ends blank`, () => {
      const m = MOVES[name];
      const start = name === 'scroll-out' ? shown(0) : shown();
      expect(litAt(m, 0)).toEqual(start);
      expect(litAt(m, length(m)).every((v) => v === 0)).toBe(true);
    });
  }

  it('stand shows the message the whole time', () => {
    const m = MOVES.stand;
    for (const f of [0, 0.3, 0.99]) expect(litAt(m, f * length(m))).toEqual(shown());
  });

  it('scroll-across enters at the right edge and leaves at the left', () => {
    const m = MOVES['scroll-across'];
    const end = length(m);
    expect(litAt(m, 0).every((v) => v === 0)).toBe(true);
    const first = litAt(m, 1.5 * STEP);
    const lit = b.dots.filter((_, i) => first[i] === 1).map((d) => d.x);
    expect(lit.length).toBeGreaterThan(0);
    expect(Math.min(...lit)).toBe(b.cols - 1);
    expect(litAt(m, end).every((v) => v === 0)).toBe(true);
    const last = litAt(m, end - 3.5 * STEP);
    const left = b.dots.filter((_, i) => last[i] === 1).map((d) => d.x);
    expect(left.length).toBeGreaterThan(0);
    expect(Math.max(...left)).toBeLessThan(5);
  });

  it('scroll-across crosses the other way when rightward', () => {
    const m = MOVES['scroll-across'];
    const step = STEP;
    const first = litAt(m, 3.5 * step, at, { direction: 'right' });
    const lit = b.dots.filter((_, i) => first[i] === 1).map((d) => d.x);
    expect(lit.length).toBeGreaterThan(0);
    expect(Math.max(...lit)).toBeLessThan(5);
  });

  it('tile refuses a one-line board', () => {
    expect(MOVES.tile.fits?.(board(80, 7))).toBe(false);
    expect(MOVES.tile.fits?.(board(80, 16))).toBe(true);
  });

  it('every move stages an empty message without throwing', () => {
    const empty = place(b, rasterize(''));
    for (const name of names) {
      const m = MOVES[name];
      const len = length(m, empty);
      expect(len).toBeGreaterThan(0);
      for (const f of [0, 0.5, 1]) expect(() => litAt(m, f * len, empty)).not.toThrow();
    }
  });

  it('every move declares its slot and settings as data', () => {
    for (const name of names) {
      const m = MOVES[name];
      expect(m.name).toBe(name);
      expect(['enter', 'active', 'exit']).toContain(m.slot);
      expect(JSON.parse(JSON.stringify(m.params))).toEqual(m.params);
    }
  });
});
