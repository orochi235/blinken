import { Button, useUndoKeys } from '@weasel-js/labkit';
import { useRef, useState } from 'react';
import { designer, useDesk } from '../compose/designer/open.js';
import { download } from '../compose/download.js';
import { IconButton } from '../compose/IconButton.js';
import { library, libraryJson, parseLibrary } from '../compose/library.js';
import './LibraryBar.css';

const undoTarget = {
  canUndo: designer.canUndo,
  canRedo: designer.canRedo,
  undo: designer.undo,
  redo: designer.redo,
};

/** The effects page's bar: undo, the library to and from a JSON file, and the way to compose. */
export function LibraryBar() {
  useDesk();
  useUndoKeys(undoTarget);
  const picker = useRef<HTMLInputElement>(null);
  const [said, setSaid] = useState<string | null>(null);
  const load = async (file: File) => {
    const { effects, dropped, read } = parseLibrary(await file.text());
    if (!read) {
      setSaid(`${file.name} is not a saved effects library; nothing changed.`);
      return;
    }
    let named: Record<string, string> = {};
    designer.change(() => {
      named = library.merge(effects);
    });
    const moved = Object.entries(named).filter(([from, to]) => from !== to);
    const notes = [
      ...(moved.length
        ? [`came in renamed: ${moved.map(([f, t]) => `${f} → ${t}`).join(', ')}`]
        : []),
      ...(dropped.length ? [`left out: ${dropped.join('; ')}`] : []),
    ];
    setSaid(notes.length ? `From ${file.name}, ${notes.join('; ')}.` : null);
  };
  return (
    <div className="effects-bar">
      <IconButton
        glyph="undo"
        label="undo"
        disabled={!designer.canUndo()}
        onClick={designer.undo}
      />
      <IconButton
        glyph="redo"
        label="redo"
        disabled={!designer.canRedo()}
        onClick={designer.redo}
      />
      {said && <span className="compose-warning">{said}</span>}
      <Button
        size="sm"
        tooltip="Download every effect in the library as one JSON file."
        onClick={() => download('bree-effects.json', libraryJson(library.get()))}
      >
        export
      </Button>
      <Button
        size="sm"
        tooltip="Add the effects in a JSON file to the library. One whose name is taken by a different effect comes in under a new name. Undo takes them out again."
        onClick={() => picker.current?.click()}
      >
        load
      </Button>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="effects file to load"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void load(file);
        }}
      />
      <a
        className="effects-link"
        href="./compose.html"
        title="Back to composing, where the library's effects are offered for every scene."
      >
        compose
      </a>
    </div>
  );
}
