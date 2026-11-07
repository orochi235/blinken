import { Button } from '@weasel-js/labkit';
import { useRef, useState } from 'react';
import { useDesk } from '../compose/designer/open.js';
import { libraryJson, parseLibrary } from '../compose/library.js';
import { download } from '../download.js';
import { UndoBar } from '../shell/UndoBar.js';
import './LibraryBar.css';

/** The effects page's bar: undo, and the library to and from a JSON file. */
export function LibraryBar() {
  const designer = useDesk();
  const { library } = designer;
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
      <UndoBar target={designer} />
      {said && <span className="compose-warning">{said}</span>}
      <Button
        size="sm"
        tooltip="Download every effect in the library as one JSON file."
        onClick={() => download('blinken-effects.json', libraryJson(library.get()))}
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
    </div>
  );
}
