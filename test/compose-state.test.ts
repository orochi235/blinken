import { describe, expect, it } from 'vitest';
import type { EffectSpec } from '@/index.js';
import {
  addPiece,
  type ComposeState,
  deleteEffect,
  moveScene,
  removePiece,
  setPiece,
  withLook,
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
  const scenes = [
    { text: 'A', hex: 0, effect: 'hold' },
    { text: 'B', hex: 0, effect: 'mine' },
    { text: 'C', hex: 0, effect: 'flip' },
  ];

  it('moves a scene up and down, and leaves it at either end', () => {
    expect(moveScene(scenes, 1, -1).map((s) => s.text)).toEqual(['B', 'A', 'C']);
    expect(moveScene(scenes, 1, 1).map((s) => s.text)).toEqual(['A', 'C', 'B']);
    expect(moveScene(scenes, 0, -1)).toEqual(scenes);
    expect(moveScene(scenes, 2, 1)).toEqual(scenes);
  });

  it('deletes a designed effect, its scenes falling back to hold', () => {
    const state: ComposeState = {
      effects: { mine: { name: 'mine', active: { move: 'stand' } } },
      program: scenes,
      layers: {},
      editing: { effect: 'mine', scene: 1 },
    };
    deleteEffect(state, 'mine');
    expect(state.effects).toEqual({});
    expect(state.program[1]?.effect).toBe('hold');
    expect(state.editing.effect).toBeUndefined();
  });
});

describe('withLook', () => {
  const scene = { text: 'HI', hex: 0, effect: 'hold' };
  it('sets a face and style switches, leaving the defaults out', () => {
    const slim = withLook(scene, 'face', 'slim');
    expect(slim).toEqual({ ...scene, face: 'slim' });
    expect(withLook(slim, 'face', 'standard')).toEqual(scene);
    const both = withLook(withLook(scene, 'reverse', true), 'proportional', true);
    expect(both.style).toEqual({ reverse: true, proportional: true });
    expect(withLook(withLook(both, 'reverse', false), 'proportional', false)).toEqual(scene);
  });
});
