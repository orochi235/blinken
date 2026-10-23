import { describe, expect, it } from 'vitest';
import type { EffectSpec } from '@/index.js';
import {
  addPiece,
  type ComposeState,
  deleteEffect,
  moveStep,
  removePiece,
  setPiece,
  withSlot,
} from '../lab/compose/state.js';

const spec: EffectSpec = {
  name: 'x',
  active: [{ move: 'stand' }, { mod: 'hue-cycle' }, { mod: 'pulse' }],
};

describe('compose state slot edits', () => {
  it('keeps both of two successive edits to different pieces in one slot', () => {
    const a = setPiece(spec, 'active', 1, { mod: 'hue-cycle', params: { rate: 2 } });
    const b = setPiece(a, 'active', 2, { mod: 'pulse', params: { depth: 0.3 } });
    expect(b.active).toEqual([
      { move: 'stand' },
      { mod: 'hue-cycle', params: { rate: 2 } },
      { mod: 'pulse', params: { depth: 0.3 } },
    ]);
  });

  it('removes and adds against the slot as it stands', () => {
    const a = setPiece(spec, 'active', 2, { mod: 'pulse', params: { depth: 0.3 } });
    const b = removePiece(a, 'active', 1);
    expect(b.active).toEqual([{ move: 'stand' }, { mod: 'pulse', params: { depth: 0.3 } }]);
    expect(addPiece(b, 'enter', { move: 'unfold' }).enter).toEqual([{ move: 'unfold' }]);
  });

  it('leaves a slot out once its last piece goes', () => {
    const one = withSlot(spec, 'exit', [{ move: 'fold' }]);
    expect(Object.hasOwn(removePiece(one, 'exit', 0), 'exit')).toBe(false);
  });
});

describe('compose state program edits', () => {
  const steps = [
    { text: 'A', hex: 0, effect: 'hold' },
    { text: 'B', hex: 0, effect: 'mine' },
    { text: 'C', hex: 0, effect: 'flip' },
  ];

  it('moves a step up and down, and leaves it at either end', () => {
    expect(moveStep(steps, 1, -1).map((s) => s.text)).toEqual(['B', 'A', 'C']);
    expect(moveStep(steps, 1, 1).map((s) => s.text)).toEqual(['A', 'C', 'B']);
    expect(moveStep(steps, 0, -1)).toEqual(steps);
    expect(moveStep(steps, 2, 1)).toEqual(steps);
  });

  it('deletes a designed effect, its steps falling back to hold', () => {
    const state: ComposeState = {
      effects: { mine: { name: 'mine', active: { move: 'stand' } } },
      program: steps,
      layers: {},
      editing: { effect: 'mine', step: 1 },
    };
    deleteEffect(state, 'mine');
    expect(state.effects).toEqual({});
    expect(state.program[1]?.effect).toBe('hold');
    expect(state.editing.effect).toBeUndefined();
  });
});
