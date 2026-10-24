import { describe, expect, it } from 'vitest';
import type { ComposeState } from '../lab/compose/state.js';
import { createUndo, editingIds, editingOf } from '../lab/compose/undo.js';

const start = (): ComposeState => ({
  effects: {},
  program: [{ text: 'HI', hex: 0xffffff, effect: 'hold' }],
  layers: {},
  editing: { scene: 0, effect: 'hold' },
});

/** A store as small as the lab's: `edit` copies, changes, then records. */
function store() {
  let state = start();
  const undo = createUndo({ get: () => state, set: (next) => (state = next) });
  return {
    undo,
    get: () => state,
    edit(fn: (s: ComposeState) => void, gesture?: string) {
      const before = state;
      const next = structuredClone(state);
      fn(next);
      state = next;
      undo.record(before, gesture);
    },
  };
}

const text = (s: ComposeState) => s.program[0]?.text;

describe('compose undo', () => {
  it('undoes and redoes an edit to the composition', () => {
    const s = store();
    s.edit((x) => {
      x.program[0] = { text: 'YO', hex: 0xffffff, effect: 'hold' };
    });
    s.undo.history.undo();
    expect(text(s.get())).toBe('HI');
    s.undo.history.redo();
    expect(text(s.get())).toBe('YO');
  });

  it('takes the edits of one gesture as one step', () => {
    const s = store();
    for (const t of ['A', 'AB', 'ABC'])
      s.edit((x) => {
        x.program[0] = { text: t, hex: 0xffffff, effect: 'hold' };
      }, 'press:1');
    s.edit((x) => {
      x.program[0] = { text: 'Z', hex: 0xffffff, effect: 'hold' };
    }, 'press:2');
    expect(s.undo.history.undoDepth()).toBe(2);
    s.undo.history.undo();
    expect(text(s.get())).toBe('ABC');
    s.undo.history.undo();
    expect(text(s.get())).toBe('HI');
  });

  it('records nothing for a change to what is open alone', () => {
    const s = store();
    s.edit((x) => {
      x.editing = { scene: 0, effect: 'rain' };
    });
    expect(s.undo.history.canUndo()).toBe(false);
  });

  it('puts back what was open before the edit, and on redo what was open when it was undone', () => {
    const s = store();
    s.edit((x) => {
      x.effects['hold copy'] = { name: 'hold copy' };
      x.editing.effect = 'hold copy';
    });
    s.edit((x) => {
      x.editing.effect = 'rain';
    });
    s.undo.history.undo();
    expect(s.get().editing).toEqual({ scene: 0, effect: 'hold' });
    expect(s.get().effects).toEqual({});
    s.undo.history.redo();
    expect(s.get().editing).toEqual({ scene: 0, effect: 'rain' });
    expect(Object.keys(s.get().effects)).toEqual(['hold copy']);
  });

  it('round-trips what is open through the ids a history keeps', () => {
    expect(editingOf(editingIds({ scene: 3, effect: 'scene: odd' }))).toEqual({
      scene: 3,
      effect: 'scene: odd',
    });
    expect(editingOf(editingIds({}))).toEqual({});
  });
});
