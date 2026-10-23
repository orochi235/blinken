import type { ControlRenderer } from '@weasel-js/labkit';
import './ColorsRow.css';
import { hexOf, numOf } from './schema.js';

/** A ColorsParam's control: a swatch per color, and buttons to add one or drop the last. */
export const colorsRow: ControlRenderer = Object.assign(
  ({ value, setValue, pref, disabled }: Parameters<ControlRenderer>[0]) => {
    const colors = (value as readonly number[] | undefined) ?? [];
    const set = (next: number[]) => setValue(next);
    return (
      <span className="colors-row">
        {colors.map((c, i) => (
          <input
            // biome-ignore lint/suspicious/noArrayIndexKey: a swatch is its place in the list
            key={i}
            type="color"
            aria-label={`${pref.name ?? 'color'} ${i + 1}`}
            value={hexOf(c)}
            disabled={disabled}
            onChange={(e) => set(colors.map((x, j) => (j === i ? numOf(e.target.value) : x)))}
          />
        ))}
        <button
          type="button"
          className="colors-row-btn"
          title="add a color"
          disabled={disabled}
          onClick={() => set([...colors, colors.at(-1) ?? 0xffffff])}
        >
          +
        </button>
        <button
          type="button"
          className="colors-row-btn"
          title="remove the last color"
          disabled={disabled || colors.length <= 1}
          onClick={() => set(colors.slice(0, -1))}
        >
          −
        </button>
      </span>
    );
  },
  { group: true },
);

/** The renderers every panel built from Params needs. */
export const RENDERERS = { colors: colorsRow };
