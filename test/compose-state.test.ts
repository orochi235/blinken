import { describe, expect, it } from 'vitest';
import type { EffectSpec } from '@/index.js';
import {
  addPiece,
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
});

describe('withLook', () => {
  const scene = { text: 'HI', hex: 0, effect: 'hold' };
  it('sets a face and style switches, leaving the defaults out', () => {
    const slim = withLook(scene, 'face', 'slim');
    expect(slim).toEqual({ ...scene, face: 'slim' });
    expect(withLook(slim, 'face', 'standard')).toEqual(scene);
    const both = withLook(withLook(scene, 'outline', true), 'monospace', true);
    expect(both.style).toEqual({ outline: true, monospace: true });
    expect(withLook(withLook(both, 'outline', false), 'monospace', false)).toEqual(scene);
  });
});

describe('effect params as pieces change', () => {
  const tuned: EffectSpec = {
    name: 't',
    enter: [{ move: 'cut-on' }, { move: 'drop-in' }],
    active: [{ move: 'stand' }],
    params: {
      drop: { label: 'drop', about: '', to: ['enter.1.ms'] },
      both: { label: 'both', about: '', to: ['enter.0.lag', 'active.0.ms'] },
    },
  };

  it('follows a piece down a place when one before it goes, and drops what pointed at the one gone', () => {
    expect(removePiece(tuned, 'enter', 0).params).toEqual({
      drop: { label: 'drop', about: '', to: ['enter.0.ms'] },
      both: { label: 'both', about: '', to: ['active.0.ms'] },
    });
  });

  it('drops a param left driving nothing, and targets a replaced piece lacks', () => {
    expect(removePiece(tuned, 'enter', 1).params).toEqual({ both: tuned.params?.both });
    const swapped = setPiece(tuned, 'enter', 1, { move: 'cut-on' });
    expect(Object.keys(swapped.params ?? {})).toEqual(['both']);
  });
});
