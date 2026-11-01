import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { rasterize } from '@/font.js';
import { bounced } from '@/moves/bounce.js';
import { type Joins, LOOSE, MOVES, type Move } from '@/moves/index.js';
import { clearAbove } from '@/moves/move.js';
import { place } from '@/orders.js';
import { values } from '@/params.js';

const setting = {} as never;
const b = board(48, 9);
const at = place(b, rasterize('HELLO'));
const n = at.text.letters.length;

/** The lit channel of every dot, `t` ms into a pass of the move. */
function frame(m: Move, t: number, given: Record<string, unknown> = {}, joins: Joins = LOOSE) {
  const patch = m.patch(at, { ...values(m), ...given } as never, joins);
  return b.dots.map((d) => patch.at(Math.min(1, t / patch.duration), d, setting).lit ?? 0);
}
const length = (m: Move, given: Record<string, unknown> = {}) =>
  m.patch(at, { ...values(m), ...given } as never).duration;
const standing = frame(MOVES.stand, 0);
const litCols = (f: readonly number[]) =>
  new Set(b.dots.filter((_, i) => (f[i] as number) > 0).map((d) => d.x));

describe('type-on and type-off', () => {
  const m = MOVES['type-on'];
  const per = values(m).ms as number;

  it('takes a letter time per letter and two blinks, or no blinks without a cursor', () => {
    expect(length(m)).toBe(n * per + 4 * 220);
    expect(length(m, { cursor: 'off' })).toBe(n * per);
  });

  it('shows the letters typed so far and a block where the next one lands', () => {
    const f = frame(m, 2.5 * per);
    const [, , third] = at.text.letters;
    if (!third) throw new Error('HELLO has five letters');
    const typed = b.dots.map((d, i) => {
      const k = at.text.letterAt(d.x - at.left);
      if (k >= 0 && k < 2) return standing[i];
      const row = at.rowOf(d);
      const inBlock = d.x - at.left >= third.x && d.x - at.left < third.x + third.width - 1;
      return row >= 0 && inBlock ? 1 : 0;
    });
    expect(f).toEqual(typed);
  });

  it('blinks the cursor off and on after the last letter', () => {
    const end = n * per;
    const lit = (t: number) => frame(m, t).filter((v) => v > 0).length;
    const message = standing.filter((v) => v > 0).length;
    expect(lit(end + 100)).toBeGreaterThan(message);
    expect(lit(end + 300)).toBe(message);
    expect(lit(end + 500)).toBeGreaterThan(message);
  });

  it('has no rests paced by time', () => {
    expect(m.rests?.(at, values(m) as never)).toBeNull();
  });

  it('paced by input, rests mid-letter with each letter down, and releases with the last', () => {
    const rests = m.rests?.(at, { ...values(m), pace: 'input' } as never);
    expect(rests).toEqual({
      at: Array.from({ length: n }, (_, k) => k * per + per / 2),
      release: n * per,
    });
    // Rest k shows k letters, as halfway through typing letter k does.
    for (const [k, r] of (rests?.at ?? []).entries())
      expect(frame(m, r)).toEqual(frame(m, k * per + 0.75 * per));
  });

  it('backspacing paced by input, rests on each letter left and releases with none', () => {
    const off = MOVES['type-off'];
    const given: Record<string, unknown> = { ...values(off), pace: 'input' };
    const rests = off.rests?.(at, given as never);
    const per = given.ms as number;
    if (!rests) throw new Error('type-off paced by input has rests');
    expect(rests.at).toHaveLength(n);
    const on = (t: number) => frame(m, t, { ms: per });
    const offAt = (t: number) => frame(off, t, given);
    // First the whole message with the cursor on after it, then one letter fewer at each rest.
    expect(offAt(rests.at[0] as number)).toEqual(on(n * per + 110));
    for (let k = 1; k < n; k++)
      expect(offAt(rests.at[k] as number)).toEqual(on((n - k) * per + per / 2));
    // Just past the release no letter is left.
    expect(offAt(rests.release + 1)).toEqual(on(0));
    expect(rests.at).toEqual([...rests.at].sort((a, b) => a - b));
  });

  it('backspaces as type-on types, in reverse', () => {
    const off = MOVES['type-off'];
    const len = length(off);
    for (const f of [0.1, 0.4, 0.8]) expect(frame(off, f * len)).toEqual(frame(m, (1 - f) * len));
  });
});

describe('assemble and scatter', () => {
  const m = MOVES.assemble;

  it('flies dots to their places from a scatter its seed picks', () => {
    const mid = frame(m, length(m) / 2);
    expect(mid.some((v) => v > 0)).toBe(true);
    expect(mid).not.toEqual(standing);
    expect(frame(m, length(m) / 2, { seed: 1 })).toEqual(mid);
    expect(frame(m, length(m) / 2, { seed: 2 })).not.toEqual(mid);
  });

  it('scatter plays assemble backward', () => {
    const s = MOVES.scatter;
    const len = length(s);
    for (const f of [0.2, 0.5, 0.9]) expect(frame(s, f * len)).toEqual(frame(m, (1 - f) * len));
  });
});

describe('bounce-in', () => {
  it('falls from its height and lands `bounces` + 1 times, each bounce lower', () => {
    const above = bounced(8, 3);
    expect(above(0)).toBe(8);
    expect(above(1)).toBeCloseTo(0);
    const ys = Array.from({ length: 2001 }, (_, i) => above(i / 2000));
    const peaks = ys.filter((y, i) => i > 0 && y > (ys[i - 1] as number) && y >= (ys[i + 1] ?? 0));
    expect(peaks.length).toBe(3);
    for (let i = 1; i < peaks.length; i++)
      expect(peaks[i] as number).toBeLessThanOrEqual(peaks[i - 1] as number);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });

  it('shows the message above its place mid-bounce', () => {
    const m = MOVES['bounce-in'];
    const above = bounced(clearAbove(at), 3);
    const t = [0.3, 0.5, 0.7].find((f) => Math.round(above(f)) > 0) ?? 0.5;
    expect(frame(m, t * length(m))).not.toEqual(standing);
  });

  it('starts above the whole sign and comes in at its top, however tall the sign', () => {
    const tall = board(48, 30);
    const placed = place(tall, rasterize('HELLO'));
    const patch = MOVES['bounce-in'].patch(placed, values(MOVES['bounce-in']) as never, LOOSE);
    const litRows = (phase: number) =>
      tall.dots.filter((d) => (patch.at(phase, d, setting).lit ?? 0) > 0).map((d) => d.y);
    expect(litRows(0)).toEqual([]);
    const first = [...Array(200).keys()].map((i) => litRows(i / 1000)).find((r) => r.length);
    expect(Math.min(...(first ?? [99]))).toBe(0);
  });
});

describe('wave', () => {
  const m = MOVES.wave;

  it('stands still at its ends beside enter and exit moves, and waves between', () => {
    const both = { from: true, to: true };
    const len = length(m);
    expect(frame(m, 0, {}, both)).toEqual(standing);
    expect(frame(m, len, {}, both)).toEqual(standing);
    expect(frame(m, len / 2, {}, both)).not.toEqual(standing);
  });

  it('loops without a seam alone', () => {
    expect(frame(m, length(m))).toEqual(frame(m, 0));
    expect(frame(m, 0)).not.toEqual(standing);
  });

  it('moves each letter whole by letter, and bends them by column', () => {
    for (const by of ['letter', 'column']) {
      const f = frame(m, 300, { by, length: 9, height: 1 });
      const bent = at.text.letters.some((s) => {
        const shifts = new Set<number>();
        for (let x = s.x; x < s.x + s.width - 1; x++) {
          const col = (g: readonly number[]) =>
            b.dots.flatMap((d, i) => (d.x === x + at.left && (g[i] as number) > 0 ? [d.y] : []));
          const [was = 0] = col(standing);
          const [now = was] = col(f);
          shifts.add(now - was);
        }
        return shifts.size > 1;
      });
      expect(bent, by).toBe(by === 'column');
    }
  });
});

describe('melt', () => {
  const m = MOVES.melt;

  it('drips straight down, never sideways, and never above where a dot hung', () => {
    const cols = litCols(standing);
    const top = Math.min(...b.dots.filter((_, i) => (standing[i] as number) > 0).map((d) => d.y));
    for (const f of [0.2, 0.5, 0.8]) {
      const g = frame(m, f * length(m));
      for (const x of litCols(g)) expect(cols.has(x)).toBe(true);
      b.dots.forEach((d, i) => {
        if ((g[i] as number) > 0) expect(d.y).toBeGreaterThanOrEqual(top);
      });
    }
  });

  it('smears a falling dot into a fading streak', () => {
    const g = frame(m, 0.5 * length(m));
    expect(g.some((v) => v > 0 && v < 1)).toBe(true);
    expect(frame(m, 0.5 * length(m), { tail: 0 }).every((v) => v === 0 || v === 1)).toBe(true);
  });
});

describe('split-in and split-out', () => {
  const middle = at.text.above + Math.ceil((at.text.rows - at.text.above - at.text.below) / 2);
  const half = (f: readonly number[], top: boolean) =>
    b.dots.flatMap((d, i) =>
      (f[i] as number) > 0 && at.rowOf(d) >= 0 && at.rowOf(d) < middle === top ? [d.x] : [],
    );
  const restLeft = (top: boolean) => Math.min(...half(standing, top));

  it('brings the top half from the left and the bottom from the right, or the other way', () => {
    const m = MOVES['split-in'];
    const mid = frame(m, length(m) / 4);
    expect(Math.min(...half(mid, true))).toBeLessThan(restLeft(true));
    expect(Math.min(...half(mid, false))).toBeGreaterThan(restLeft(false));
    const right = frame(m, length(m) / 4, { direction: 'right' });
    expect(Math.min(...half(right, true))).toBeGreaterThan(restLeft(true));
  });

  it('split-out plays split-in backward', () => {
    const out = MOVES['split-out'];
    const inn = MOVES['split-in'];
    const len = length(out);
    for (const f of [0.2, 0.6]) expect(frame(out, f * len)).toEqual(frame(inn, (1 - f) * len));
  });
});
