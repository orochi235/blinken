import { createHistory, type History, swapOp } from '@weasel-js/history';
import type { ComposeState } from './state.js';

/** The part of the state undo steps through. What is open and picked is view state, restored around each step. */
export type Composition = Pick<ComposeState, 'program' | 'effects'>;

export const compositionOf = ({ program, effects }: ComposeState): Composition => ({
  program,
  effects,
});

const SCENE = 'scene:';

/** What is open, as the ids a history keeps for a selection. */
export function editingIds(editing: ComposeState['editing']): string[] {
  const ids: string[] = [];
  if (editing.scene !== undefined) ids.push(SCENE + editing.scene);
  return ids;
}

export function editingOf(ids: readonly string[]): ComposeState['editing'] {
  const editing: ComposeState['editing'] = {};
  for (const id of ids) {
    if (id.startsWith(SCENE)) editing.scene = Number(id.slice(SCENE.length));
  }
  return editing;
}

/** Where undo reads and writes the state it steps. */
export interface UndoHost {
  get(): ComposeState;
  set(next: ComposeState): void;
}

export interface Undo {
  history: History;
  /**
   * Records an edit already made, from `before`. Edits sharing a `gesture` with the one before
   * them, and nothing between, become one step. An edit leaving the composition as it was records
   * nothing.
   */
  record(before: ComposeState, gesture?: string): void;
}

/** An undo history over a compose store's composition. */
export function createUndo(host: UndoHost, limit = 200): Undo {
  const history = createHistory(null, {
    historyLimit: limit,
    selection: {
      get: () => editingIds(host.get().editing),
      set: (ids) => host.set({ ...host.get(), editing: editingOf(ids) }),
    },
  });
  const put = (c: Composition) => host.set({ ...host.get(), ...c });
  return {
    history,
    record(before, gesture) {
      const was = compositionOf(before);
      const now = compositionOf(host.get());
      if (JSON.stringify(was) === JSON.stringify(now)) return;
      const op = swapOp({ name: 'compose', label: 'edit', before: was, after: now, emit: put });
      history.recordEntry([op], 'edit', {
        selectionBefore: editingIds(before.editing),
        ...(gesture === undefined ? {} : { coalesceKey: gesture }),
      });
    },
  };
}
