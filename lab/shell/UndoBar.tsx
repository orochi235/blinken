import { useUndoKeys } from '@weasel-js/labkit';
import { useSyncExternalStore } from 'react';
import { IconButton } from '../compose/IconButton.js';
import './UndoBar.css';

/** Something a page's undo steps: a store's history, or its controls'. */
export interface Undoable {
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  subscribe(fn: () => void): () => void;
}

/** Undo and redo for `target`, as two buttons and as the usual chords. */
export function UndoBar({ target }: { target: Undoable }) {
  useUndoKeys(target);
  const moves = () => `${target.canUndo()}:${target.canRedo()}`;
  const [canUndo, canRedo] = useSyncExternalStore(target.subscribe, moves, moves).split(':');
  return (
    <div className="lab-undo">
      <IconButton glyph="undo" label="undo" disabled={canUndo !== 'true'} onClick={target.undo} />
      <IconButton glyph="redo" label="redo" disabled={canRedo !== 'true'} onClick={target.redo} />
    </div>
  );
}
