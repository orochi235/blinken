import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { rasterize } from '@/font.js';
import { MODULATORS } from '@/modulators/index.js';
import { MOVES } from '@/moves/index.js';
import { place } from '@/orders.js';
import { values } from '@/params.js';

// Everything that loops, at its defaults, wraps from the end of a pass to the start of the next
// with no bigger jump than it makes anywhere within the pass, so back-to-back passes show no seam.
// Effects that step (sparkle, neon) jump every step anyway; one that glides must glide across the
// wrap too.
const setting = {} as never;
const b = board(48, 9);
const at = place(b, rasterize('HELLO'));
const STEPS = 400;

type Patch = { at(u: number, s: unknown, setting: never): Record<string, unknown> };

/** The largest change in any channel of any subject between two frames. */
function jump(a: Record<string, unknown>[], z: Record<string, unknown>[]): number {
  let most = 0;
  const diff = (x: unknown, y: unknown, k = ''): number => {
    // Hue is an angle in degrees, so 359 and 1 are 2 apart.
    if (k === 'hue' && typeof x === 'number' && typeof y === 'number') {
      const d = Math.abs(x - y) % 360;
      return Math.min(d, 360 - d);
    }
    if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y);
    if (Array.isArray(x) && Array.isArray(y)) return Math.max(0, ...x.map((v, i) => diff(v, y[i])));
    return JSON.stringify(x) === JSON.stringify(y) ? 0 : 1;
  };
  for (const [i, p] of a.entries()) {
    const q = z[i] as Record<string, unknown>;
    for (const k of new Set([...Object.keys(p), ...Object.keys(q)]))
      most = Math.max(most, diff(p[k], q[k], k));
  }
  return most;
}

/** The jump across the wrap, and the largest jump between neighboring frames within the pass. */
function wrap(patch: Patch, subjects: readonly unknown[]) {
  const frames = Array.from({ length: STEPS }, (_, i) =>
    subjects.map((s) => patch.at(i / STEPS, s, setting)),
  );
  let within = 0;
  for (let i = 1; i < STEPS; i++)
    within = Math.max(within, jump(frames[i - 1] as never, frames[i] as never));
  return { across: jump(frames[STEPS - 1] as never, frames[0] as never), within };
}

const seamless = ({ across, within }: { across: number; within: number }) =>
  across <= within * 1.5 + 1e-6;

/** Each number param at its least and most, the others at their defaults. */
function extremes(
  params: Record<string, { min?: number; max?: number }>,
): [string, Record<string, number>][] {
  return Object.entries(params).flatMap(([k, p]) =>
    typeof p.min === 'number' && typeof p.max === 'number'
      ? [
          [`${k}=${p.min}`, { [k]: p.min }],
          [`${k}=${p.max}`, { [k]: p.max }],
        ]
      : [],
  ) as never;
}

describe('loops close at every setting', () => {
  it("holds at each number setting's least and most", () => {
    const open: string[] = [];
    for (const [name, m] of Object.entries(MOVES).filter(([, m]) => m.slot === 'active'))
      for (const [label, given] of extremes(m.params as never)) {
        const w = wrap(
          m.patch(at, { ...values(m), ...given } as never) as unknown as Patch,
          b.dots,
        );
        if (!seamless(w)) open.push(`${name} ${label} ${JSON.stringify(w)}`);
      }
    for (const [name, m] of Object.entries(MODULATORS)) {
      if (['dim', 'desaturate'].includes(name)) continue;
      for (const [label, given] of extremes(m.params as never)) {
        const subjects = m.on === 'cells' ? b.cells : b.dots;
        const w = wrap(
          m.patch(at, { ...values(m), ...given } as never, () => 0) as unknown as Patch,
          subjects,
        );
        if (!seamless(w)) open.push(`${name} ${label} ${JSON.stringify(w)}`);
      }
    }
    expect(open).toEqual([]);
  }, 30_000);
});

describe('loops close', () => {
  const active = Object.entries(MOVES).filter(([, m]) => m.slot === 'active');
  it.each(active)('the %s move wraps without a seam', (_, m) => {
    const w = wrap(m.patch(at, values(m) as never) as unknown as Patch, b.dots);
    expect(w, JSON.stringify(w)).toSatisfy(seamless);
  });

  // These change once and stay changed, so a loop can't close without making them something else.
  const ONE_WAY = ['dim', 'desaturate'];
  it.each(Object.entries(MODULATORS))('the %s modulator wraps without a seam', (name, m) => {
    const subjects = m.on === 'cells' ? b.cells : b.dots;
    const w = wrap(m.patch(at, values(m) as never, () => 0) as unknown as Patch, subjects);
    expect(seamless(w), JSON.stringify(w)).toBe(!ONE_WAY.includes(name));
  });
});
