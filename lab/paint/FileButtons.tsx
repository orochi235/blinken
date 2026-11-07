import { Button } from '@weasel-js/labkit';
import { useRef, useState } from 'react';
import { download } from '../download.js';
import { usePaintStore } from './context.js';
import { encode, fromJson, toJson } from './share.js';

/** Saves the picture as a JSON file, loads one back in its place, and copies a link to it. */
export function FileButtons() {
  const paint = usePaintStore();
  const drawing = () => {
    const { layout, picture, stamps } = paint.get();
    return { layout, picture, stamps };
  };
  const picker = useRef<HTMLInputElement>(null);
  const [said, setSaid] = useState<string | null>(null);
  const load = async (file: File) => {
    const opened = fromJson(await file.text());
    setSaid(opened ? null : `${file.name} is not a saved picture; nothing changed.`);
    if (opened) paint.open(opened);
  };
  return (
    <>
      <Button
        size="sm"
        tooltip="Download this board, picture and text as a JSON file."
        onClick={() => download('picture.json', toJson(drawing()))}
      >
        save
      </Button>
      <Button
        size="sm"
        tooltip="Open a saved JSON file in place of this picture. Undo brings this one back."
        onClick={() => picker.current?.click()}
      >
        load
      </Button>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="picture file to load"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void load(file);
        }}
      />
      <Button
        size="sm"
        tooltip="Copy a link that opens this board, picture and text."
        onClick={() => {
          const url = `${location.origin}${location.pathname}#${encode(drawing())}`;
          void navigator.clipboard.writeText(url);
        }}
      >
        copy link
      </Button>
      {said && <span className="paint-warning">{said}</span>}
    </>
  );
}
