import { Button } from '@weasel-js/labkit';
import { useRef, useState } from 'react';
import { download } from '../download.js';
import { fromJson, toJson } from '../share.js';
import { compose } from '../store.js';

/** A file name from the first scene's text: `tonight.json`, or `composition.json` without one. */
const fileName = () => {
  const text = compose.get().program[0]?.text ?? '';
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'composition'}.json`;
};

const save = () => download(fileName(), toJson(compose.get()));

/** Saves the composition as a JSON file, and loads one back in place of it, as one undoable edit. */
export function FileButtons() {
  const picker = useRef<HTMLInputElement>(null);
  const [said, setSaid] = useState<string | null>(null);
  const load = async (file: File) => {
    const { state, dropped, read } = fromJson(await file.text());
    if (!read) {
      setSaid(`${file.name} is not a saved composition; nothing changed.`);
      return;
    }
    setSaid(dropped.length ? `Left out of ${file.name}: ${dropped.join('; ')}.` : null);
    compose.edit(
      (s) => {
        s.effects = state.effects;
        s.program = state.program;
        s.editing = { scene: 0 };
      },
      { replay: 'picked' },
    );
  };
  return (
    <>
      {said && <span className="compose-warning">{said}</span>}
      <Button size="sm" tooltip="Download this composition as a JSON file." onClick={save}>
        save
      </Button>
      <Button
        size="sm"
        tooltip="Open a saved JSON file in place of this composition. Undo brings this one back."
        onClick={() => picker.current?.click()}
      >
        load
      </Button>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="composition file to load"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void load(file);
        }}
      />
    </>
  );
}
