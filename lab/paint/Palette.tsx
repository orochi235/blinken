import type { CSSProperties } from 'react';
import './Palette.css';

/** Lite-Brite's pegs and the hues between them, a warm white, and white. */
export const PALETTE = {
  red: 0xff3030,
  orange: 0xff7a1e,
  amber: 0xffb020,
  yellow: 0xffe23a,
  lime: 0xb6ff3a,
  green: 0x4dff5a,
  mint: 0x3affb0,
  cyan: 0x3ae8ff,
  sky: 0x3ab4ff,
  blue: 0x3a6cff,
  indigo: 0x6a4aff,
  violet: 0xb05aff,
  magenta: 0xff3aff,
  pink: 0xff5ac8,
  warm: 0xffd8a0,
  white: 0xffffff,
} as const;
export type Swatch = keyof typeof PALETTE | 'custom';

const cssOf = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
export const hexOf = (s: string) => Number.parseInt(s.slice(1), 16);

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
