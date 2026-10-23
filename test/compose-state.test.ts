import { describe, expect, it } from 'vitest';
import type { EffectSpec } from '@/index.js';
import { addPiece, removePiece, setPiece, withSlot } from '../lab/compose/state.js';

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
