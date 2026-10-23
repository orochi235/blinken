import { oklab } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { rasterize } from '@/font.js';
import { MODULATORS, type ModulatorName } from '@/modulators/index.js';
import { place, rankOf } from '@/orders.js';
import { values } from '@/params.js';

const setting = {} as never;
const b = board(80, 7);
const at = place(b, rasterize('HI'));
const names = Object.keys(MODULATORS) as ModulatorName[];
const together = rankOf({ by: 'together' }, at);
const column = rankOf({ by: 'column' }, at);

/** The pose of `s`, `t` ms into a cycle of the modulator. */
function poseAt(
  name: ModulatorName,
  t: number,
  s: Subject = b.dots[0] as Subject,
  given: Record<string, unknown> = {},
  rank = together,
): Partial<Pose> {
  const m = MODULATORS[name];
  const p = { ...values(m), ...given } as never;
  return m.patch(at, p, rank).at((t / m.length(at, p)) % 1, s, setting);
}

describe('modulators', () => {
  it('flash takes gain to 0 for half of each cycle and to 1 for the rest', () => {
    expect(poseAt('flash', 100).gain).toBe(1);
    expect(poseAt('flash', 400).gain).toBe(1);
    expect(poseAt('flash', 600).gain).toBe(0);
    expect(poseAt('flash', 900).gain).toBe(0);
  });

  it('hue-cycle at rate 1 turns the hue a full 360 in 1000 ms', () => {
    const at0 = poseAt('hue-cycle', 0).hue as number;
    expect(at0).toBeCloseTo(0);
    expect(poseAt('hue-cycle', 500).hue).toBeCloseTo(180);
    expect(poseAt('hue-cycle', 999.9).hue).toBeCloseTo(360, 0);
  });

  it('spreads by phase: column order shifts neighbors by the phase per step', () => {
    const [d0, d1] = [b.dots[0], b.dots[1]] as Subject[];
    const step = 0.05;
    const given = { phase: step, shape: 'triangle' };
    const first = poseAt('pulse', 200, d0, given, column).gain;
    const next = poseAt('pulse', 200 - step * 1000, d1, given, column).gain;
    expect(next).toBeCloseTo(first as number);
    expect(poseAt('pulse', 200, d1, given, column).gain).not.toBeCloseTo(first as number);
  });

  it('palette steps through its colors in order', () => {
    const colors = [0xff0000, 0x00ff00, 0x0000ff];
    const tints = [0, 1, 2].map((i) => poseAt('palette', i * 400 + 10, undefined, { colors }).tint);
    expect(new Set(tints.map((t) => t?.join())).size).toBe(3);
    const again = poseAt('palette', 3 * 400 + 10, undefined, { colors }).tint;
    expect(again).toEqual(tints[0]);
  });

  it('two-color blends from its first color to its second', () => {
    const colors = [0xff0000, 0x0000ff];
    const tint = (t: number) => poseAt('two-color', t, undefined, { colors }).tint as number[];
    expect(tint(750)).toEqual(oklab(colors[0] as number).map((v) => expect.closeTo(v, 6)));
    expect(tint(250)).toEqual(oklab(colors[1] as number).map((v) => expect.closeTo(v, 6)));
  });

  it('dim eases gain from 1 to 1 - depth over its length', () => {
    const g = (t: number) => poseAt('dim', t, undefined, { ms: 1000, depth: 0.5, sweep: 0 }).gain;
    expect(g(0)).toBe(1);
    expect(g(999.999)).toBeCloseTo(0.5, 3);
  });

  it('one-shots sweep their starts over the pass and all end by phase 1', () => {
    for (const name of ['dim', 'desaturate', 'flare'] as const) {
      const m = MODULATORS[name];
      const ch = m.writes[0] as 'gain' | 'chroma' | 'glow';
      const given = { ms: 1000, depth: 0.5, sweep: 0.5 };
      const [first, last] = [b.dots[0], b.dots[79]] as Subject[];
      const end = poseAt(name, 999.999, first, given, column)[ch];
      expect(poseAt(name, 999.999, last, given, column)[ch]).toBeCloseTo(end as number, 2);
      if (name !== 'flare') {
        expect(poseAt(name, 300, first, given, column)[ch]).not.toBe(1);
        expect(poseAt(name, 300, last, given, column)[ch]).toBe(1);
      }
    }
  });

  it('flare goes up to 1 + depth and back', () => {
    const g = (t: number) => poseAt('flare', t, undefined, { ms: 1000, depth: 2, sweep: 0 }).glow;
    expect(g(0)).toBe(1);
    expect(g(500)).toBeCloseTo(3);
    expect(g(999.999)).toBeCloseTo(1, 2);
  });

  it('chase plays on cells and sparkle on dots', () => {
    expect(MODULATORS.chase.on).toBe('cells');
    expect(MODULATORS.sparkle.on).toBe('dots');
    const lit = [0, 1, 2].map((i) => poseAt('chase', 10, { kind: 'cell', i }).lit);
    expect(lit).toEqual([1, 0.1, 0.1]);
    expect(poseAt('chase', 10, { kind: 'cell', i: 0 }).tint).toEqual(oklab(0xffe2b0));
  });

  for (const name of names) {
    it(`${name} writes only the channels it declares`, () => {
      const m = MODULATORS[name];
      const subject: Subject = m.on === 'cells' ? { kind: 'cell', i: 0 } : (b.dots[40] as Subject);
      const channels = Object.keys(KIT);
      for (const t of [0, 100, 330, 770]) {
        const pose = poseAt(name, t, subject);
        for (const c of Object.keys(pose)) expect(m.writes).toContain(c);
        expect(channels).toEqual(expect.arrayContaining(Object.keys(pose)));
      }
    });
  }
});
