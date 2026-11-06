import type { Fault } from '../defects.js';
import type { Lamps } from '../draw.js';
import type { FrameCost } from '../marquee-api.js';
import type { Fade, Ghost } from '../optics.js';
import type { Backend } from '../render/backend.js';
import type { Gpu } from '../render/gpu.js';
import type { Ticker } from '../ticker.js';
import type { Align, Ends, Selection, TypeName } from './type.js';

/** A fault in one segment of a readout: its cell, and its slot in the type's cell. */
export type ReadoutDefect = Fault & {
  readonly at: { readonly cell: number; readonly slot: number };
};

export interface ReadoutOptions {
  readonly type: TypeName;
  /** How many cells it has. */
  readonly cells: number;
  /** A dark faceplate behind it, its unlit segments showing on it; or nothing, only lit segments. Default `'plate'`. */
  readonly face?: 'plate' | 'none';
  /** Its color, as hex. Default amber, or orange for a Nixie. */
  readonly color?: number;
  /** How far it leans, as x per y. Default 0. */
  readonly slant?: number;
  readonly ends?: Ends;
  /** Default: right for numbers, left for text, as its type says. */
  readonly align?: Align;
  /** Whether a ½ digit leads it, showing a leading 1 or a minus. */
  readonly half?: boolean;
  readonly defects?: readonly ReadoutDefect[];
  /** On a panel: its top left, in the canvas's CSS pixels. */
  readonly at?: { readonly x: number; readonly y: number };
  /** On a panel: its height in CSS pixels, faceplate included. */
  readonly height?: number;
  /** On an overlay: the element it is fitted inside. */
  readonly follow?: Element;
  readonly value?: string | number;
  /**
   * Whether its characters can be selected and copied, a selected cell showing as a block of the
   * page's selection color, for a type that spells letters or numbers. On an overlay its cells then
   * take the pointer. Default true.
   */
  readonly select?: boolean;
  /** How a selected cell shows, in place of its type's way. */
  readonly selection?: Selection;
  /**
   * Whether it can be typed into, for a type that spells and no ½ digit: click it, and what is
   * typed shows on its cells, a blinking bar under the cell the caret stands at. Default false.
   */
  readonly edit?: boolean;
  /** What a screen reader calls it: an editable one's field's name, else its group's. */
  readonly label?: string;
  /** Called with its value as typed, each time it changes. */
  readonly onInput?: (value: string) => void;
  /**
   * An editable one's keys, before its own handling of them; `preventDefault` keeps them from it.
   * Enter, Escape or ↑ ↓ to step a number go here.
   */
  readonly onKeyDown?: (e: KeyboardEvent) => void;
  /** Called when an editable one's field loses the focus. */
  readonly onBlur?: () => void;
  /** Attributes for an editable one's field, such as `role`, `inputmode` or `aria-valuenow`. */
  readonly field?: Readonly<Record<string, string>>;
  /**
   * How many rows of cells it has, for a type that spells; a `\n` in its value starts a row. Not
   * with a ½ digit. Default 1.
   */
  readonly lines?: number;
  /** Whether a word that won't fit its row moves to the next, on more than one row. Default true. */
  readonly wrap?: boolean;
  /**
   * What selecting and copying it gives: its characters as `shown`, in the case its glyphs draw
   * (an uppercase-only type gives capitals), or as in its `value`. Default `'shown'`.
   */
  readonly copy?: 'shown' | 'value';
}

/** A readout on a surface. */
export interface Readout {
  readonly value: string | number;
  set(value: string | number): void;
  color(hex: number): void;
  /** Moves it, on a panel. */
  moveTo(at: { readonly x: number; readonly y: number }, height?: number): void;
  setDefects(defects: readonly ReadoutDefect[]): void;
  /** Sets attributes on an editable one's field, as `field` does. */
  setField(attributes: Readonly<Record<string, string>>): void;
  /** Changes how its selected cells show; undefined goes back to its own. */
  setSelection(look: Selection | undefined): void;
  destroy(): void;
}

export interface SurfaceOptions {
  readonly gpu?: Gpu | null;
  readonly backend?: Backend;
  readonly lamps?: Lamps;
  readonly fade?: Fade;
  /**
   * How much an unlit segment shows of its lit neighbors: `row` along a segment line, the same
   * segment across a readout's cells; `col` down a column of the surface, which crosses readouts.
   */
  readonly ghost?: Ghost;
  readonly ticker?: Ticker;
  /** Whether it draws; false runs its mix with nothing drawn. Default true. */
  readonly draw?: boolean;
  /** Called after each frame with what it cost, as a marquee's `onFrame` is. */
  readonly onFrame?: (cost: FrameCost) => void;
}

/** One canvas, one sign and one mix, drawing every readout made on it. */
export interface Surface {
  readout(opts: ReadoutOptions): Readout;
  readonly backend: Backend;
  destroy(): void;
}
