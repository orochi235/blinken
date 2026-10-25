import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { type EffectSpec, stageEffect } from '@/effects.js';
import { placeText } from '@/orders.js';
import { type MovePiece, piecesOf } from '@/pieces.js';
import { stageProgram } from '@/program.js';
import { targetOf, tuned, tuningOf } from '@/tuning.js';

describe('effect params', () => {
  it('points every built-in param at settings its effect has', () => {
    for (const [name, effect] of Object.entries(EFFECTS)) {
      const declared: Record<string, { to: readonly string[] }> = effect.params ?? {};
      for (const [param, p] of Object.entries(declared))
        for (const path of p.to)
          expect(targetOf(effect, path), `${name} ${param} ${path}`).toBeDefined();
    }
  });

  it('offers what an effect declares, defaulting to its own settings, then blend and lag', () => {
    const fall = tuningOf(EFFECTS.fall);
    expect(Object.keys(fall)).toEqual(['drop', 'scatter', 'blend']);
    expect(fall.drop).toMatchObject({ value: 350, label: 'drop time' });
    expect(fall.scatter).toMatchObject({ value: 9 });
    expect(Object.keys(tuningOf(EFFECTS.hold))).toEqual(['flashes', 'blend', 'lag']);
    expect(tuningOf(EFFECTS.hold).lag).toMatchObject({ value: 14 });
  });

  it('writes a value to everything it drives, held to its range, ignoring names it lacks', () => {
    const fall = tuned(EFFECTS.fall, { drop: 500, scatter: 1e9, nonsense: 3 });
    const [enter] = piecesOf(fall.enter);
    const [exit] = piecesOf(fall.exit);
    expect(enter?.params?.ms).toBe(500);
    expect(exit?.params?.ms).toBe(500);
    expect((enter as MovePiece).order?.lag).toBe(400);
    expect(tuned(EFFECTS.fall, undefined)).toBe(EFFECTS.fall);
    expect(tuned(EFFECTS.hold, { lag: 30, blend: 200 })).toMatchObject({
      order: { by: 'column', lag: 30 },
      blend: 200,
    });
  });

  it('tunes a choice and a list of colors, ignoring a value its setting cannot take', () => {
    expect(tuningOf(EFFECTS.scroll).direction).toMatchObject({
      choices: ['left', 'right'],
      value: 'left',
    });
    const right = tuned(EFFECTS.scroll, { direction: 'right' });
    expect(piecesOf(right.active)[0]?.params?.direction).toBe('right');
    expect(tuned(EFFECTS.scroll, { direction: 'up' })).toEqual(EFFECTS.scroll);
    const glow = {
      name: 'glow',
      active: [{ move: 'stand' }, { mod: 'palette' }],
      params: { colors: { label: 'colors', about: '', to: ['active.1.colors'] } },
    } as EffectSpec;
    expect('colors' in (tuningOf(glow).colors ?? {})).toBe(true);
    const red = tuned(glow, { colors: [0xff0000, 0x00ff00] });
    expect(piecesOf(red.active)[1]?.params?.colors).toEqual([0xff0000, 0x00ff00]);
  });

  it('stages a scene with its effect as the scene tunes it', () => {
    const b = board(40, 7);
    const plain = stageProgram(b, [{ text: 'HI', hex: 0, effect: 'fall' }]);
    const slow = stageProgram(b, [{ text: 'HI', hex: 0, effect: 'fall', params: { drop: 1000 } }]);
    const want = stageEffect(tuned(EFFECTS.fall, { drop: 1000 }), placeText(b, 'HI'), 0);
    expect(slow[0]?.staged.ms).toBe(want.ms);
    expect(slow[0]?.staged.ms).toBeGreaterThan(plain[0]?.staged.ms ?? Infinity);
  });
});
