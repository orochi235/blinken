import { Button } from '@weasel-js/labkit';
import { useState } from 'react';
import { FACE_NAMES, type FaceName } from '@/index.js';
import { usePaintStore } from './context.js';
import type { Layout, Stamp } from './model.js';
import { stampDots } from './stamps.js';

/**
 * The text tool's controls. With a stamp picked up they edit it; otherwise they set up the next one,
 * which `add` drops in the board's top left, in the brush's color and brightness.
 */
export function TextBar({
  picked,
  layout,
  hex,
  level,
}: {
  picked: Stamp | null;
  layout: Layout;
  hex: number;
  level: number;
}) {
  const paint = usePaintStore();
  const [draft, setDraft] = useState({ text: 'HELLO', face: 'standard' as FaceName });
  const text = picked?.text ?? draft.text;
  const face = picked?.face ?? draft.face;
  const edit = (change: { text?: string; face?: FaceName }) =>
    picked ? paint.editPicked(change) : setDraft({ ...draft, ...change });

  return (
    <div className="paint-row">
      <label className="paint-field">
        text
        <input
          className="paint-text"
          value={text}
          onChange={(e) => edit({ text: e.currentTarget.value })}
        />
      </label>
      <label className="paint-field">
        font
        <select value={face} onChange={(e) => edit({ face: e.currentTarget.value as FaceName })}>
          {FACE_NAMES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <Button
        size="sm"
        tooltip="Drop the text on the board, to drag where it goes."
        disabled={text.trim() === ''}
        onClick={() => paint.addStamp({ text, face, x: 1, y: 1, hex, level })}
      >
        add
      </Button>
      <Button
        size="sm"
        tooltip="Paint the picked-up text into the picture, where the brushes reach it."
        disabled={!picked}
        onClick={() => picked && paint.stampDown(stampDots(picked, layout))}
      >
        stamp down
      </Button>
      <Button
        size="sm"
        tooltip="Remove the picked-up text."
        disabled={!picked}
        onClick={paint.removePicked}
      >
        delete
      </Button>
    </div>
  );
}
