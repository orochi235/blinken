import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose } from '@/board.js';
import { rasterize } from '@/font.js';
import { MODULATORS, type ModulatorName } from '@/modulators/index.js';
import { ranked, recent } from '@/modulators/shader.js';
import { place, rankOf } from '@/orders.js';
import { values } from '@/params.js';

const setting = {} as never;
const b = board(80, 7);
const at = place(b, rasterize('HI'));
const names = Object.keys(MODULATORS) as ModulatorName[];

/** Two poses alike to f32, which a shader's tables hold their contents in. */
function near(got: Partial<Pose>, want: Partial<Pose>) {
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  for (const [k, v] of Object.entries(want)) {
    const g = [got[k as keyof Pose]].flat() as number[];
    [v].flat().forEach((x, i) => {
      expect(g[i]).toBeCloseTo(x as number, 6);
    });
  }
}

describe('recent', () => {
  it('keeps the values last asked for, a hit counting as asked', () => {
    let made = 0;
    const get = recent<number, number>(2);
    const ask = (k: number) => get(k, () => ++made);
    ask(1);
    ask(2);
    ask(1);
    ask(3);
    expect(made).toBe(3);
    expect(ask(1)).toBe(1);
    expect(made).toBe(3);
    ask(2);
    expect(made).toBe(4);
  });
});

describe('modulator shaders', () => {
  const orders = ['together', 'column', 'column-reverse', 'center', 'row'] as const;
  /** Settings past the defaults that take another branch of a shader. */
  const more: Partial<Record<ModulatorName, Record<string, unknown>[]>> = {
    sparkle: [{ share: 0.05 }, { share: 0 }],
    pulse: [{ shape: 'square' }, { shape: 'triangle' }],
    flash: [
      { flashes: 3, from: 0.2, to: 0.8, depth: 0.7 },
      { from: 0.5, to: 0.5 },
    ],
    invert: [{ shape: 'triangle' }, { shape: 'sine', phase: 0.05 }],
    neon: [{ often: 60, length: 1500 }],
    shimmer: [{ every: 900, angle: -40 }],
    chase: [{ dim: 0 }],
    glitch: [{ often: 120, strength: 1 }],
    palette: [{ colors: [0x112233, 0xff8800, 0x00ffcc] }],
    gradient: [{ direction: 'down', colors: [0x112233, 0xff8800, 0x00ffcc] }],
  };
  for (const name of names.filter((n) => MODULATORS[n].shader))
    it(`${name}: the shader's at gives what patch does where it plays, and rests elsewhere`, () => {
      const m = MODULATORS[name];
      const rest = Object.fromEntries(m.writes.map((c) => [c, KIT[c].rest]));
      let checked = 0;
      for (const given of [{}, ...(more[name] ?? [])])
        for (const by of orders) {
          const p = values(m, given as never) as never;
          const sp = m.shader?.(at, p, ranked({ by }, b));
          if (!sp) continue;
          checked++;
          const plain = m.patch(at, p, rankOf({ by }, at));
          expect(sp.duration).toBe(plain.duration);
          const dots = b.dots.filter((_, k) => k % 7 === 0);
          const [on, off] = m.on === 'cells' ? [b.cells, dots] : [dots, b.cells];
          for (const phase of [0, 0.137, 0.5, 0.861, 0.0412, 0.733])
            for (const s of on) near(sp.at(phase, s, setting), plain.at(phase, s, setting));
          for (const s of off) expect(sp.at(0.3, s, setting)).toEqual(rest);
        }
      expect(checked).toBeGreaterThan(0);
    });
});
