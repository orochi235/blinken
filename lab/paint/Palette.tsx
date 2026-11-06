import type { CSSProperties } from 'react';
import './Palette.css';
import { cssOf } from '@/index.js';
import { PALETTE } from '../palette.js';

export { PALETTE };

export type Swatch = keyof typeof PALETTE | 'custom';

/** The color swatches, and a well for a color of your own. */
export function Palette({
  swatch,
  custom,
  onSwatch,
  onCustom,
}: {
  swatch: Swatch;
  custom: string;
  onSwatch: (s: Swatch) => void;
  onCustom: (css: string) => void;
}) {
  return (
    <div className="paint-palette">
      {(Object.keys(PALETTE) as (keyof typeof PALETTE)[]).map((name) => (
        <button
          key={name}
          type="button"
          className="paint-swatch"
          // The swatch's color is the palette's data, not a style of its own.
          style={{ '--swatch': cssOf(PALETTE[name]) } as CSSProperties}
          aria-label={name}
          title={name}
          aria-pressed={swatch === name}
          onClick={() => onSwatch(name)}
        />
      ))}
      <label
        className="paint-swatch paint-custom"
        title="a color of your own"
        data-on={swatch === 'custom'}
      >
        <input
          type="color"
          value={custom}
          aria-label="a color of your own"
          onClick={() => onSwatch('custom')}
          onChange={(e) => {
            onCustom(e.currentTarget.value);
            onSwatch('custom');
          }}
        />
      </label>
    </div>
  );
}
