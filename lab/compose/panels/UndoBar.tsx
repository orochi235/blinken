import { useUndoKeys } from '@weasel-js/labkit';
import { useSyncExternalStore } from 'react';
import { IconButton } from '../IconButton.js';
import { compose } from '../store.js';
import './UndoBar.css';

const { history } = compose;
const target = {
  canUndo: () => history.canUndo(),
  canRedo: () => history.canRedo(),
  undo: compose.undo,
  redo: compose.redo,
};
const subscribe = (fn: () => void) => history.subscribe(fn);
const moves = () => `${history.canUndo()}:${history.canRedo()}`;

/** Undo and redo for the composition, as buttons in the top bar and as the usual chords. */
export function UndoBar() {
  useUndoKeys(target);
  const [canUndo, canRedo] = useSyncExternalStore(subscribe, moves, moves).split(':');
  return (
    <div className="compose-undo">
      <IconButton glyph="undo" label="undo" disabled={canUndo !== 'true'} onClick={compose.undo} />
      <IconButton glyph="redo" label="redo" disabled={canRedo !== 'true'} onClick={compose.redo} />
    </div>
  );
}
