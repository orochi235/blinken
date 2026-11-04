import { oklab } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { rasterize } from '@/font.js';
import { MODULATORS, type ModulatorName } from '@/modulators/index.js';
import { ranked } from '@/modulators/shader.js';
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
  const cycle = m.patch(at, p, rank);
  return cycle.at((t / cycle.duration) % 1, s, setting);
}

describe('modulators', () => {
  it('flash takes gain to 0 for half of each cycle and to 1 for the rest', () => {
    expect(poseAt('flash', 100).gain).toBe(1);
    expect(poseAt('flash', 400).gain).toBe(1);
    expect(poseAt('flash', 600).gain).toBe(0);
    expect(poseAt('flash', 900).gain).toBe(0);
  });

  it('flash keeps its flashes inside its window, each dark for the second half of its beat', () => {
    const given = { ms: 3000, flashes: 2, from: 0.5, to: 1 };
    const g = (t: number) => poseAt('flash', t, undefined, given).gain;
    expect([100, 1400, 1700, 2100, 2400, 2900].map(g)).toEqual([1, 1, 1, 0, 1, 0]);
  });

  it('hue-cycle at rate 1 turns the hue a full 360 in 1000 ms', () => {
    const at0 = poseAt('hue-cycle', 0).hue as number;
    expect(at0).toBeCloseTo(0);
    expect(poseAt('hue-cycle', 500).hue).toBeCloseTo(180);
    expect(poseAt('hue-cycle', 999.9).hue).toBeCloseTo(360, 0);
  });

  it('hue-cycle turns the hue only as far as its arc, in degrees', () => {
    expect(poseAt('hue-cycle', 500, undefined, { arc: 90 }).hue).toBeCloseTo(45);
    expect(poseAt('hue-cycle', 999.9, undefined, { arc: 90 }).hue).toBeCloseTo(90, 0);
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

  it('at the largest sweep the last column still reaches the end value', () => {
    for (const name of ['dim', 'desaturate', 'flare'] as const) {
      const m = MODULATORS[name];
      const ch = m.writes[0] as 'gain' | 'chroma' | 'glow';
      const max = (m.params.sweep as { max: number }).max;
      const given = { ms: 1000, depth: 0.5, sweep: max };
      const [first, last] = [b.dots[0], b.dots[79]] as Subject[];
      const end = poseAt(name, 999.999, first, given, column)[ch];
      expect(poseAt(name, 999.999, last, given, column)[ch]).toBeCloseTo(end as number, 2);
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

  it('invert holds at depth when steady and swings from 0 to depth otherwise', () => {
    expect(poseAt('invert', 0).invert).toBe(1);
    expect(poseAt('invert', 1300, undefined, { depth: 0.4 }).invert).toBe(0.4);
    const sq = (t: number) => poseAt('invert', t, undefined, { shape: 'square', rate: 1 }).invert;
    expect(new Set([0, 250, 500, 750].map(sq))).toEqual(new Set([0, 1]));
  });

  it('invert sweeps across the sign when spread by column', () => {
    const given = { shape: 'sine', rate: 1, phase: 0.1 };
    const at0 = poseAt('invert', 0, b.dots[0] as Subject, given, column).invert;
    const at3 = poseAt('invert', 0, b.dots.find((d) => d.x === 3) as Subject, given, column).invert;
    expect(at0).not.toBeCloseTo(at3 as number, 3);
  });

  it('scanline keeps gain within its dimming and lights the band brightest', () => {
    const given = { speed: 9, band: 2, dim: 0.4 };
    const row = (y: number, t: number) =>
      poseAt('scanline', t, b.dots.find((d) => d.y === y) as Subject, given);
    for (const t of [0, 120, 340, 610, 900]) {
      for (let y = 0; y < 7; y++) {
        const { gain, glow } = row(y, t);
        expect(gain).toBeGreaterThanOrEqual(0.6 - 1e-9);
        expect(gain).toBeLessThanOrEqual(1);
        expect(glow).toBeGreaterThanOrEqual(1);
        expect(glow).toBeLessThanOrEqual(1.6 + 1e-9);
      }
    }
    // Nine rows of travel at nine rows a second, starting a band's half above the top row.
    const t = (4 / 9) * 1000;
    expect(row(3, t).gain).toBeCloseTo(1);
    expect(row(3, t).glow).toBeCloseTo(1.6);
    expect(row(0, t).gain).toBeLessThan(0.7);
  });

  it('fire tints the top rows yellower than the bottom and keeps gain in range', () => {
    const at = (y: number, t: number) =>
      poseAt('fire', t, b.dots.find((d) => d.x === 20 && d.y === y) as Subject, { intensity: 0 });
    const [top, low] = [at(0, 0).tint, at(6, 0).tint] as number[][];
    expect(top?.[0]).toBeGreaterThan(low?.[0] as number);
    expect(top?.[2]).toBeGreaterThan(low?.[2] as number);
    expect(at(3, 0).gain).toBe(1);
    for (const t of [0, 250, 1700, 3300])
      for (const d of b.dots.filter((_, i) => i % 37 === 0)) {
        const { gain, tint } = poseAt('fire', t, d, { intensity: 0.8 });
        expect(gain).toBeGreaterThanOrEqual(0.2 - 1e-9);
        expect(gain).toBeLessThanOrEqual(1);
        expect(tint?.[3]).toBeCloseTo(3);
      }
  });

  it('fire flickers the same way every time and differs from moment to moment', () => {
    const d = b.dots[200] as Subject;
    expect(poseAt('fire', 777, d)).toEqual(poseAt('fire', 777, d));
    const gains = new Set([0, 200, 400, 600, 800].map((t) => poseAt('fire', t, d).gain));
    expect(gains.size).toBeGreaterThan(1);
  });

  /** Every 50 ms frame of a minute-long loop, for one dot. */
  const minute = (name: ModulatorName, d: Subject, given: Record<string, unknown> = {}) =>
    Array.from({ length: 1200 }, (_, f) => poseAt(name, f * 50 + 25, d, given));

  it('glitch is calm between bursts, and in one turns the hue hard or drops out or inverts', () => {
    const poses = b.dots.filter((_, i) => i % 23 === 0).flatMap((d) => minute('glitch', d));
    const hit = poses.filter((p) => p.hue !== 0);
    expect(hit.length).toBeGreaterThan(0);
    expect(hit.length).toBeLessThan(poses.length * 0.05);
    for (const p of poses) {
      expect([0, 1]).toContain(p.gain);
      expect([0, 1]).toContain(p.invert);
      if (p.hue === 0) expect(p).toEqual({ hue: 0, gain: 1, invert: 0 });
      else expect(Math.abs(p.hue as number)).toBeGreaterThanOrEqual(50);
    }
  });

  it('glitch plays the same bursts for a seed and others for another', () => {
    const d = b.dots[300] as Subject;
    const run = (seed: number) => minute('glitch', d, { seed, often: 120 }).map((p) => p.hue);
    expect(run(4)).toEqual(run(4));
    expect(run(4)).not.toEqual(run(5));
  });

  it('neon holds steady at 0 a minute, and otherwise goes out now and then', () => {
    const dots = b.dots.filter((_, i) => i % 11 === 0);
    for (const d of dots)
      for (const p of minute('neon', d, { often: 0 })) {
        expect(p.gain).toBeGreaterThanOrEqual(0.9);
        expect(p.glow).toBe(1.25);
      }
    const out = dots.flatMap((d) => minute('neon', d)).filter((p) => (p.gain as number) < 0.1);
    expect(out.length).toBeGreaterThan(0);
  });

  it('neon flickers each rank of its spread as one tube, the same for a seed', () => {
    const letter = rankOf({ by: 'letter' }, at);
    const tube = at.board.dots.filter((d) => letter(d) === 1);
    const given = { often: 60, seed: 3 };
    const gains = (d: Subject) =>
      Array.from({ length: 600 }, (_, f) => poseAt('neon', f * 100, d, given, letter).gain);
    expect(gains(tube[0] as Subject)).toEqual(gains(tube[tube.length - 1] as Subject));
    expect(gains(tube[0] as Subject)).toEqual(gains(tube[0] as Subject));
  });

  it('shimmer rests between glints and lifts lit, glow, and paleness as one passes', () => {
    const given = { every: 4000, width: 3, angle: 0 };
    for (const d of b.dots.filter((_, i) => i % 13 === 0))
      expect(poseAt('shimmer', 2500, d, given)).toEqual({ lit: 0, glow: 1, chroma: 1 });
    const mid = poseAt('shimmer', 550, b.dots.find((d) => d.x === 40) as Subject, given);
    expect(mid.lit).toBeGreaterThan(0.25);
    expect(mid.glow).toBeGreaterThan(3);
    expect(mid.chroma).toBeLessThan(0.5);
  });

  it('shimmer leans its glint by its angle', () => {
    const glint = (x: number, y: number, angle: number) =>
      poseAt('shimmer', 664, b.dots.find((d) => d.x === x && d.y === y) as Subject, {
        angle,
      }).glow as number;
    expect(glint(40, 0, 0)).toBeCloseTo(glint(40, 6, 0));
    // At 45° the glint's top runs a column ahead for every row up.
    expect(glint(40, 0, 45)).toBeGreaterThan(3);
    expect(glint(40, 0, 45)).toBeCloseTo(glint(46, 6, 45));
    expect(glint(40, 6, 45)).toBe(1);
  });

  it('aurora keeps its hue within half its range either way, drifting and closing its loop', () => {
    const given = { range: 120, speed: 0.1 };
    for (const t of [0, 1300, 4100, 7700])
      for (const d of b.dots.filter((_, i) => i % 7 === 0))
        expect(Math.abs(poseAt('aurora', t, d, given).hue as number)).toBeLessThanOrEqual(60);
    const d = b.dots[123] as Subject;
    expect(poseAt('aurora', 0, d, given).hue).toBeCloseTo(
      poseAt('aurora', 9999.99, d, given).hue as number,
      3,
    );
    const across = new Set(
      b.dots.slice(0, 80).map((s) => poseAt('aurora', 0, s, given).hue?.toFixed(2)),
    );
    expect(across.size).toBeGreaterThan(20);
  });

  it('gradient runs from its first color to its last, across or down', () => {
    const colors = [0xff0000, 0x0000ff];
    const tint = (x: number, y: number, direction = 'across') =>
      poseAt('gradient', 0, b.dots.find((d) => d.x === x && d.y === y) as Subject, {
        colors,
        direction,
      }).tint as number[];
    const end = (hex: number) => oklab(hex).map((v) => expect.closeTo(v * 3, 3));
    expect(tint(0, 3)).toEqual(end(0xff0000));
    expect(tint(79, 3)).toEqual(end(0x0000ff));
    expect(tint(10, 0, 'down')).toEqual(end(0xff0000));
    expect(tint(10, 6, 'down')).toEqual(end(0x0000ff));
    expect(tint(10, 3, 'down')).toEqual(tint(70, 3, 'down'));
    expect(poseAt('gradient', 0, b.dots[5] as Subject)).toEqual(
      poseAt('gradient', 700, b.dots[5] as Subject),
    );
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

describe('modulator shaders', () => {
  const orders = ['together', 'column', 'column-reverse', 'center', 'row'] as const;
  for (const name of names.filter((n) => MODULATORS[n].shader))
    it(`${name}: the shader's at gives what patch does where it plays, and rests elsewhere`, () => {
      const m = MODULATORS[name];
      const p = values(m) as never;
      const rest = Object.fromEntries(m.writes.map((c) => [c, KIT[c].rest]));
      let checked = 0;
      for (const by of orders) {
        const sp = m.shader?.(at, p, ranked({ by }, b));
        if (!sp) continue;
        checked++;
        const plain = m.patch(at, p, rankOf({ by }, at));
        expect(sp.duration).toBe(plain.duration);
        const dots = b.dots.filter((_, k) => k % 7 === 0);
        const [on, off] = m.on === 'cells' ? [b.cells, dots] : [dots, b.cells];
        for (const phase of [0, 0.137, 0.5, 0.861])
          for (const s of on) expect(sp.at(phase, s, setting)).toEqual(plain.at(phase, s, setting));
        for (const s of off) expect(sp.at(0.3, s, setting)).toEqual(rest);
      }
      expect(checked).toBeGreaterThan(0);
    });
});
