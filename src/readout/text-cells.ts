import type { Reach } from './across.js';
import type { Spot } from './layout.js';

/** A readout's boxes in a text layer. */
export interface One {
  /** What the surface knows it by, the same across rebuilds. */
  readonly key: unknown;
  readonly spot: Spot;
  readonly group: HTMLElement;
  readonly texts: Text[];
  readonly cells: HTMLElement[];
  /** Whether the browser's highlight shows as a block over each selected cell. */
  readonly block: boolean;
  /** Its fit when last placed, so an unmoved readout isn't restyled. */
  at: string;
  /** An editable one's field: a text area where it has more than one row. */
  input: HTMLInputElement | HTMLTextAreaElement | null;
  /** Each character's cell, or -1 where it shows nowhere. */
  places: readonly number[];
  /** Its value as it copies, a character for each of the value's. */
  copied: string;
  /** For each caret place, the cell a caret there stands at. */
  carets: readonly (number | null)[];
  /** It as a drag from any readout on the page reaches it. */
  readonly reach: Reach;
}

/** What a press on a readout needs of its layer. */
export interface Pressing {
  readonly doc: Document;
  /** Tells the surface what is picked now. */
  report(): void;
  /** Follows the pointer with `move` until the button comes up, ending a drag already running. */
  drag(move: (m: MouseEvent) => void): void;
  /** The readout known by `key` now, after any rebuild. */
  find(key: unknown): One | null;
}

/** What of a readout is picked: the cells a selection takes in, and the cell a caret stands at. */
export interface Picked {
  readonly cells: readonly boolean[];
  readonly caret: number | null;
}

/** The cell of `r` nearest (`x`, `y`), in client pixels: in the nearest row, the nearest across. */
export function cellAt(r: One, x: number, y: number): number {
  let best = 0;
  let gap = Number.POSITIVE_INFINITY;
  for (const [k, cell] of r.cells.entries()) {
    const b = cell.getBoundingClientRect();
    const off = Math.max(0, Math.abs(y - (b.top + b.bottom) / 2) - b.height / 2);
    const d = off * 1e4 + Math.abs(x - (b.left + b.right) / 2);
    if (d < gap) {
      gap = d;
      best = k;
    }
  }
  return best;
}
