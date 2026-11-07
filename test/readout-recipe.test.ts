import { describe, expect, it } from 'vitest';
import { createTransition } from '@/readout/recipe.js';
import { type CellShown, type Change, TRANSITIONS } from '@/readout/transitions.js';
import { TYPES } from '@/readout/types/index.js';

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

const litIn = (frame: (light: string) => number) =>
  TYPES.sixteen.cell.lights
    .map((l) => l.name)
    .filter((name) => frame(name) === 1)
    .sort()
    .join();
const as = (ch: string) => [...spell.lights(ch)].sort().join();
/** Which cells show their new character at `t`. */
const landed = (frames: (t: number) => readonly ((l: string) => number)[], t: number, to: string) =>
  frames(t).map((f, k) => litIn(f) === as(to[k] as string));

describe('createTransition', () => {
  it('carries the recipe it was made from, for every built-in', () => {
    for (const [name, t] of Object.entries(TRANSITIONS)) {
      expect(t.recipe.name).toBe(name);
      expect(createTransition(t.recipe).ms).toBe(t.ms);
    }
  });

  it('turns cells in the order asked', () => {
    const recipe = { name: 'w', ms: 100, move: 'cut', spread: 1 } as const;
    const at = (order: 'left' | 'right' | 'center' | 'edges', t = 0.3) =>
      landed(createTransition({ ...recipe, order }).start(change('AAAAA', 'BBBBB')), t, 'BBBBB');
    expect(at('left')).toEqual([true, true, false, false, false]);
    expect(at('right')).toEqual([false, false, false, true, true]);
    expect(at('center', 0.6)).toEqual([false, true, true, true, false]);
    expect(at('edges')).toEqual([true, false, false, false, true]);
  });

  it('turns every cell once in a random order, the same for the same change', () => {
    const t = createTransition({ name: 'r', ms: 100, move: 'cut', order: 'random', spread: 1 });
    const frames = t.start(change('AAAAA', 'BBBBB'));
    const counts = [0.1, 0.3, 0.55, 0.8, 1].map(
      (u) => landed(frames, u, 'BBBBB').filter(Boolean).length,
    );
    expect(counts).toEqual([1, 2, 3, 4, 5]);
    expect(landed(t.start(change('AAAAA', 'BBBBB')), 0.3, 'BBBBB')).toEqual(
      landed(frames, 0.3, 'BBBBB'),
    );
  });

  it('steps through its own sequence', () => {
    const t = createTransition({ name: 's', ms: 100, move: 'step', through: ' AXB' });
    const frames = t.start(change('A', 'B'));
    const seen = Array.from({ length: 20 }, (_, i) => litIn(frames(i / 20)[0] ?? (() => 0)));
    expect(seen.filter((s, i) => i === 0 || s !== seen[i - 1])).toEqual(['A', 'X', 'B'].map(as));
  });

  it('eases a fade', () => {
    const at = (easing: 'linear' | 'in' | 'out') => {
      const frame = createTransition({ name: 'f', ms: 100, move: 'fade', easing }).start(
        change(' ', 'A'),
      )(0.5)[0];
      return frame?.([...spell.lights('A')][0] as string) ?? -1;
    };
    expect(at('linear')).toBeCloseTo(0.5);
    expect(at('in')).toBeLessThan(0.5);
    expect(at('out')).toBeGreaterThan(0.5);
  });

  it('fades where a type cannot spell a step', () => {
    const c = { ...change('A', 'B'), spell: undefined };
    const frames = createTransition({ name: 's', ms: 100, move: 'step' }).start(c);
    const only = [...spell.lights('B')].find((l) => !spell.lights('A').has(l)) as string;
    expect(frames(0.5)[0]?.(only)).toBeCloseTo(0.5);
  });
});
