import { type Mix, mix } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { EFFECTS, type EffectName } from '@/builtins.js';
import { cueEffect, stageEffect } from '@/effects.js';
import { rasterize } from '@/font.js';
import { MOVES } from '@/moves/index.js';
import { place } from '@/orders.js';
import { values } from '@/params.js';

const b = board(80, 7);
const HEX = 0xff9a2e;
const at = (text: string) => ({ ...place(b, rasterize(text)), label: text });

function cued(name: EffectName, text: string, hold?: number): Mix<Subject, Pose> {
  const m = mix<Subject, Pose>(KIT);
  m.sync(0);
  cueEffect(m, m.owns({ name: 'scene' }), stageEffect(EFFECTS[name], at(text), HEX, hold), name);
  return m;
}

describe('EFFECTS', () => {
  it('every built-in stages on an 80 × 7 board without warnings', () => {
    for (const name of Object.keys(EFFECTS) as EffectName[]) {
      const effect = EFFECTS[name];
      const staged = stageEffect(effect, at('HELLO'), HEX);
      expect(staged.warnings, name).toEqual([]);
      expect(staged.ms, name).toBeGreaterThan(0);
    }
  });

  it('hold flashes three times in the middle third of its hold, steady either side', () => {
    const m = cued('hold', 'HELLO');
    const x = 40;
    const dot = b.dots[x] as Subject;
    // Column x's arc starts x lags in, and its active part after the 1 ms cut-on.
    const gainAt = (t: number) => {
      m.sync(14 * x + 1 + t);
      return m.probe(dot).gain;
    };
    const lit = [100, 600, 1100, 1300, 1700, 2100, 2500, 3000, 3500];
    const dark = [1500, 1900, 2300];
    for (const t of [...lit, ...dark].sort((p, q) => p - q))
      expect(gainAt(t), `${t}`).toBe(dark.includes(t) ? 0 : 1);
  });

  it('hold held 7200 by its scene still flashes three times in its middle third', () => {
    const m = cued('hold', 'HELLO', 7200);
    const x = 40;
    const dot = b.dots[x] as Subject;
    const gainAt = (t: number) => {
      m.sync(14 * x + 1 + t);
      return m.probe(dot).gain;
    };
    const lit = [100, 2000, 2500, 3300, 4100, 5000, 7000];
    const dark = [3000, 3800, 4600];
    for (const t of [...lit, ...dark].sort((p, q) => p - q))
      expect(gainAt(t), `${t}`).toBe(dark.includes(t) ? 0 : 1);
  });

  it('flip held 6000 still stands each letter upright either side of its tumble', () => {
    const a = at('ABC');
    const m = cued('flip', 'ABC', 6000);
    const fold = 300;
    const letter0 = b.dots.filter((d) => d.x >= a.left && d.x < a.left + 6);
    const stand = MOVES.stand.patch(a, values(MOVES.stand));
    const upright = letter0.map((d) => stand.at(0, d, {} as never).lit);
    const litAt = (t: number) => {
      m.sync(fold + t);
      return letter0.map((d) => m.probe(d).lit);
    };
    expect(litAt(1500)).toEqual(upright);
    expect(litAt(2250)).not.toEqual(upright);
    expect(litAt(5000)).toEqual(upright);
  });

  it('flip overlaps letters', () => {
    const m = cued('flip', 'ABC');
    const marks = m.marks(0, 10_000);
    const markOf = (mark: string, name: string) =>
      marks.find((k) => k.mark === mark && k.name === name)?.timestamp as number;
    // Letter 0 is still standing in its active part when letter 2 finishes unfolding.
    expect(markOf('out', 'flip 0')).toBeGreaterThan(markOf('in', 'flip 2'));
  });

  it('flip keeps each letter upright through the first third of its active part', () => {
    const a = at('ABC');
    const m = cued('flip', 'ABC');
    const fold = 300;
    m.sync(fold + 600);
    const letter0 = b.dots.filter((d) => d.x >= a.left && d.x < a.left + 6);
    const stand = MOVES.stand.patch(a, values(MOVES.stand));
    expect(letter0.map((d) => m.probe(d).lit)).toEqual(
      letter0.map((d) => stand.at(0, d, {} as never).lit),
    );
  });

  it('roll lands its letters left to right', () => {
    const text = 'ABC';
    const a = at(text);
    const m = cued('roll', text);
    const want = (d: Subject) =>
      d.kind === 'dot' && a.rowOf(d) >= 0 && a.text.lit(d.x - a.left, a.rowOf(d)) ? 1 : 0;
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
