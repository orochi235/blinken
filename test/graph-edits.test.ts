import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EFFECTS, type EffectSpec } from '@/index.js';
import { applied, commitEdit, verdictOf } from '../lab/compose/designer/graphEdits.js';
import {
  editOfDelete,
  editOfDrop,
  editOfMove,
  editOfReconnect,
  itemVerdict,
  pieceOfItem,
  stepVerdict,
  wireVerdict,
} from '../lab/compose/designer/graphEvents.js';
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

describe('moving a piece between steps', () => {
  it('moves a modulator into another step at the index it lands on', () => {
    const edit = editOfMove(mine, { id: 'piece:active:1', x: 0, y: 0, parent: 'step:enter' }, 0);
    expect(edit).toEqual({ kind: 'move', from: flare, to: { slot: 'enter', index: 0 } });
    const moved = applied(mine, edit as never);
    expect(moved.enter).toEqual([{ mod: 'flare' }, { move: 'drop-in' }]);
    expect(moved.active).toEqual([{ move: 'stand' }, { mod: 'sparkle' }, { mod: 'hue-cycle' }]);
  });

  it('refuses a move into a step it does not belong to, with the reason', () => {
    expect(stepVerdict(mine, ['piece:enter:0'], 'step:exit')).toEqual({
      refuse: 'drop-in is an enter move',
    });
    expect(stepVerdict(mine, ['piece:active:1'], 'step:exit')).toBe(true);
    expect(stepVerdict(mine, ['piece:active:1'], 'channel:glow')).toBe(false);
    expect(
      editOfMove(mine, { id: 'piece:enter:0', x: 0, y: 0, parent: 'step:exit' }, 0),
    ).toBeNull();
  });

  it('reorders a piece dragged to another place in its own step', () => {
    const edit = editOfMove(mine, { id: 'piece:active:3', x: 0, y: 0 }, 0);
    expect(edit).toEqual({
      kind: 'move',
      from: { slot: 'active', index: 3 },
      to: { slot: 'active', index: 0 },
    });
    expect(applied(mine, edit as never).active).toEqual([
      { mod: 'hue-cycle' },
      { move: 'stand' },
      { mod: 'flare' },
      { mod: 'sparkle' },
    ]);
  });

  it('asks nothing of a drag that lands where it was or outside every step', () => {
    expect(editOfMove(mine, { id: 'piece:active:1', x: 0, y: 0 }, 1)).toBeNull();
    expect(editOfMove(mine, { id: 'piece:active:1', x: 0, y: 0, parent: null }, 0)).toBeNull();
    expect(editOfMove(mine, { id: 'channel:glow', x: 0, y: 0, parent: 'step:exit' }, 0)).toBeNull();
  });

  it('carries a param driving the moved piece along with it', () => {
    const tuned: EffectSpec = {
      ...mine,
      params: { swell: { label: 'swell', about: '', to: ['active.1.depth', 'active.2.share'] } },
    };
    const moved = applied(tuned, {
      kind: 'move',
      from: flare,
      to: { slot: 'exit', index: 1 },
    });
    expect(moved.params?.swell?.to).toEqual(['exit.1.depth', 'active.1.share']);
  });

  it('commits a move as one undo step and picks the piece where it landed', () => {
    const desk = deskOf(mine);
    commitEdit(desk, { kind: 'move', from: flare, to: { slot: 'exit', index: 1 } });
    expect(desk.picked()).toBe('piece:exit:1');
    expect(desk.library.get().mine?.exit).toEqual([{ move: 'drop-out' }, { mod: 'flare' }]);
    desk.undo();
    expect(desk.library.get().mine).toEqual(mine);
  });
});

describe('adding and removing pieces on the diagram', () => {
  const at = { x: 0, y: 0 };
  it('adds a palette item dropped in a step at the place marked there', () => {
    const drop = {
      item: { mod: 'dim' },
      target: 'step:active',
      container: 'step:active',
      index: 1,
      at,
    };
    const edit = editOfDrop(mine, drop);
    expect(edit).toEqual({ kind: 'add', piece: { mod: 'dim' }, to: { slot: 'active', index: 1 } });
    expect(applied(mine, edit as never).active).toEqual([
      { move: 'stand' },
      { mod: 'dim' },
      { mod: 'flare' },
      { mod: 'sparkle' },
      { mod: 'hue-cycle' },
    ]);
  });

  it('adds an item dropped on a step node last, and on a piece before it', () => {
    const onStep = { target: 'step:exit', container: null, index: null, at };
    expect(editOfDrop(mine, { item: { mod: 'dim' }, ...onStep })).toMatchObject({
      to: { slot: 'exit', index: 1 },
    });
    const onPiece = { target: 'piece:active:2', container: null, index: null, at };
    expect(editOfDrop(mine, { item: { mod: 'dim' }, ...onPiece })).toMatchObject({
      to: { slot: 'active', index: 2 },
    });
  });

  it('refuses a move dropped in another step, and ignores the canvas and stray items', () => {
    const target = { target: 'step:exit', container: 'step:exit', index: 0, at };
    expect(itemVerdict(mine, { move: 'drop-in' }, target)).toEqual({
      refuse: 'drop-in is an enter move',
    });
    expect(itemVerdict(mine, { move: 'drop-out' }, target)).toBe(true);
    const bare = { target: null, container: null, index: null, at };
    expect(itemVerdict(mine, { mod: 'dim' }, bare)).toBe(false);
    expect(pieceOfItem({ mod: 'nonsense' })).toBeNull();
    expect(pieceOfItem('dim')).toBeNull();
  });

  it('takes out a picked piece on Delete, and never a step or a channel', () => {
    expect(editOfDelete(mine, { nodes: ['piece:active:1'], edges: [] })).toEqual({
      kind: 'remove',
      at: flare,
    });
    const step = { nodes: ['step:active', 'piece:active:0', 'piece:active:1'], edges: [] };
    expect(editOfDelete(mine, step)).toBeNull();
    expect(editOfDelete(mine, { nodes: ['channel:glow'], edges: [] })).toBeNull();
  });

  it('commits a removal as one undo step, copying a built-in first, and picks nothing', () => {
    const desk = createDesigner({ library: createLibrary({ effects: {} }), open: 'fall' });
    desk.setPicked('piece:enter:0');
    commitEdit(desk, { kind: 'remove', at: { slot: 'enter', index: 0 } });
    expect(desk.open()).toBe('fall copy');
    expect(desk.library.get()['fall copy']?.enter).toBeUndefined();
    expect(desk.picked()).toBeUndefined();
    desk.undo();
    expect(desk.library.get()).toEqual({});
    expect(desk.open()).toBe('fall');
    expect(EFFECTS.fall.enter).toBeDefined();
  });
});
