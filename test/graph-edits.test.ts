import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { EffectSpec } from '@/index.js';
import {
  applied,
  commitEdit,
  editOfReconnect,
  verdictOf,
  wireVerdict,
} from '../lab/compose/designer/graphEdits.js';
import { createDesigner } from '../lab/compose/designer/open.js';
import { createLibrary } from '../lab/compose/library.js';

const mine: EffectSpec = {
  name: 'mine',
  enter: { move: 'drop-in' },
  active: [{ move: 'stand' }, { mod: 'flare' }, { mod: 'sparkle' }, { mod: 'hue-cycle' }],
  exit: { move: 'drop-out' },
  hold: 1700,
};
const flare = { slot: 'active', index: 1 } as const;

// An edit asks which gesture it belongs to, which reads the focused element.
beforeAll(() => {
  vi.stubGlobal('document', { activeElement: null });
  vi.stubGlobal('HTMLInputElement', class {});
  vi.stubGlobal('HTMLTextAreaElement', class {});
});

const deskOf = (spec: EffectSpec, open = spec.name) =>
  createDesigner({ library: createLibrary({ effects: { [spec.name]: spec } }), open });

describe('rewiring on the diagram', () => {
  it('moves a one-curve modulator to a channel that mixes as its own does', () => {
    const edit = { kind: 'rewire', at: flare, channel: 'gain' } as const;
    expect(verdictOf(mine, edit)).toBe(true);
    expect(applied(mine, edit).active).toContainEqual({
      mod: 'flare',
      params: { channel: 'gain' },
    });
  });

  it('refuses a channel that mixes otherwise, and every wire of a fixed piece, with a reason', () => {
    const refused = (v: unknown) => expect(v).toMatchObject({ refuse: expect.any(String) });
    refused(verdictOf(mine, { kind: 'rewire', at: flare, channel: 'lit' }));
    for (const index of [0, 2, 3])
      refused(verdictOf(mine, { kind: 'rewire', at: { slot: 'active', index }, channel: 'gain' }));
    expect(applied(mine, { kind: 'rewire', at: flare, channel: 'lit' })).toBe(mine);
  });

  it('reads a reconnect of a wire’s channel end, and refuses its piece end', () => {
    const edge = 'piece:active:1>channel:glow';
    expect(editOfReconnect(mine, { edge, end: 'to', node: 'channel:chroma' })).toEqual({
      kind: 'rewire',
      at: flare,
      channel: 'chroma',
    });
    expect(wireVerdict(mine, edge, 'to', 'channel:chroma')).toBe(true);
    expect(wireVerdict(mine, edge, 'to', 'piece:active:0')).toBe(false);
    expect(wireVerdict(mine, edge, 'from', 'piece:active:0')).toMatchObject({
      refuse: expect.any(String),
    });
    expect(editOfReconnect(mine, { edge, end: 'from', node: 'piece:active:0' })).toBeNull();
  });

  it('commits as one undo step and picks the piece', () => {
    const desk = deskOf(mine);
    commitEdit(desk, { kind: 'rewire', at: flare, channel: 'gain' });
    expect(desk.library.get().mine?.active).toContainEqual({
      mod: 'flare',
      params: { channel: 'gain' },
    });
    expect(desk.picked()).toBe('piece:active:1');
    desk.undo();
    expect(desk.library.get().mine).toEqual(mine);
    expect(desk.canUndo()).toBe(false);
  });

  it('takes no undo step for a rewire onto the channel already driven', () => {
    const desk = deskOf(mine);
    commitEdit(desk, { kind: 'rewire', at: flare, channel: 'glow' });
    expect(desk.canUndo()).toBe(false);
  });
});
