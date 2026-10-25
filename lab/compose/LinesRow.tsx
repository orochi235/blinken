import { type ControlRenderer, PropertyRow } from '@weasel-js/labkit';
import './LinesRow.css';

/** The most lines the box grows to before it scrolls. */
const TALLEST = 4;

/** A message's row: a text box that takes a new line with Enter, as tall as its lines. */
export const linesRow: ControlRenderer = Object.assign(
  ({ value, setValue, pref, disabled }: Parameters<ControlRenderer>[0]) => {
    const text = typeof value === 'string' ? value : '';
    return (
      <PropertyRow
        group
        span
        layout="inline"
        label={pref.name ?? 'text'}
        description={pref.description}
        disabled={disabled}
      >
        <textarea
          className="lines-row"
          aria-label={pref.name ?? 'text'}
          title={pref.description}
          rows={Math.min(TALLEST, text.split('\n').length)}
          spellCheck={false}
          value={text}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
        />
      </PropertyRow>
    );
  },
  { group: true },
);
