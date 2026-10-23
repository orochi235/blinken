import { type Mix, mix } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { EFFECTS, type EffectName } from '@/builtins.js';
import { cueEffect, stageEffect } from '@/effects.js';
import { rasterize } from '@/font.js';
import { place } from '@/orders.js';
import { fits } from '@/program.js';

const b = board(80, 7);
const HEX = 0xff9a2e;
const at = (text: string) => ({ ...place(b, rasterize(text)), label: text });

function cued(name: EffectName, text: string): Mix<Subject, Pose> {
  const m = mix<Subject, Pose>(KIT);
  m.sync(0);
  cueEffect(m, m.owns({ name: 'step' }), stageEffect(EFFECTS[name], at(text), HEX), name);
  return m;
}

describe('EFFECTS', () => {
  it('every built-in stages on an 80 × 7 board without warnings, except tile which does not fit', () => {
    for (const name of Object.keys(EFFECTS) as EffectName[]) {
      const effect = EFFECTS[name];
      expect(fits(b, effect), name).toBe(name !== 'tile');
      const staged = stageEffect(effect, at('HELLO'), HEX);
      expect(staged.warnings, name).toEqual([]);
      expect(staged.ms, name).toBeGreaterThan(0);
    }
    expect(fits(board(80, 15), EFFECTS.tile)).toBe(true);
  });

  it('hold flashes: at its middle some lit dots have gain 0', () => {
    const { ms } = stageEffect(EFFECTS.hold, at('HELLO'), HEX);
    const m = cued('hold', 'HELLO');
    m.sync(ms / 2);
    const lit = b.dots.filter((d) => m.probe(d).lit > 0);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.some((d) => m.probe(d).gain === 0)).toBe(true);
    // Lit again before the wipe off begins.
    m.sync(1 + 3550);
    expect(m.probe(b.dots[0] as Subject).gain).toBe(1);
  });

  it('flip overlaps letters', () => {
    const m = cued('flip', 'ABC');
    const ins = m.marks(0, 10_000).filter((k) => k.mark === 'in');
    const inOf = (name: string) => ins.find((k) => k.name === name)?.timestamp as number;
    // Letter 0 is tumbling before letter 2 has finished unfolding.
    expect(inOf('flip 0')).toBeLessThan(inOf('flip 2'));
    expect(inOf('flip 2') - inOf('flip 0')).toBe(180);
  });

  it('roll lands its letters left to right', () => {
    const text = 'ABC';
    const a = at(text);
    const m = cued('roll', text);
    const want = (d: Subject) =>
      d.kind === 'dot' && d.row >= 0 && a.text.lit(d.x - a.left, d.row) ? 1 : 0;
    const letter = (k: number) => b.dots.filter((d) => Math.floor((d.x - a.left) / 6) === k);
    m.sync(900 + 10);
    expect(letter(0).map((d) => m.probe(d).lit)).toEqual(letter(0).map(want));
    expect(letter(2).map((d) => m.probe(d).lit)).not.toEqual(letter(2).map(want));
  });

  it('fall drops columns in and out at different random times', () => {
    const { arcs } = stageEffect(EFFECTS.fall, at('HELLO'), HEX);
    expect(arcs).toHaveLength(1);
    const voice = (part: unknown) => (Array.isArray(part) ? part : [part])[1];
    const din = voice(arcs[0]?.spec.enter).stagger as (s: Subject) => number;
    const dout = voice(arcs[0]?.spec.exit).stagger as (s: Subject) => number;
    const ins = b.dots.slice(0, 80).map(din);
    const outs = b.dots.slice(0, 80).map(dout);
    expect(new Set(ins).size).toBe(80);
    expect(ins).not.toEqual(outs);
  });
});
