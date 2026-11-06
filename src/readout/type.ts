/** A segment's shape, in its cell's units from the cell's top left. */
export type SegShape =
  | { readonly kind: 'disc'; readonly x: number; readonly y: number; readonly r: number }
  | {
      readonly kind: 'bar';
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
      /** Full width. */
      readonly w: number;
    }
  | { readonly kind: 'tri'; readonly points: readonly (readonly [number, number])[] }
  | {
      readonly kind: 'poly';
      readonly points: readonly (readonly [number, number])[];
      /** Full stroke width. */
      readonly w: number;
    };

/** One light of a cell: a segment, a point, a cathode. Its slot is its index in the cell's lights. */
export interface SegLight {
  readonly name: string;
  readonly shapes: readonly SegShape[];
}

export type Ends = 'point' | 'round' | 'square';
export type Align = 'left' | 'right';

export type TypeName =
  | 'seven'
  | 'eight'
  | 'nine'
  | 'half'
  | 'fourteen'
  | 'sixteen'
  | 'twentytwo'
  | 'nixie'
  | 'cistercian'
  | 'matrix'
  | 'maya'
  | 'kaktovik'
  | 'rods'
  | 'braille'
  | 'ogham'
  | 'morse'
  | 'semaphore'
  | 'dice'
  | 'tally'
  | 'bcd'
  | 'bargraph'
  | 'triangles'
  | 'triangles-fine';

/** A kind of segment display: one cell's lights, and how a value lights a row of cells. */
export interface DisplayType {
  readonly name: TypeName;
  readonly cell: {
    readonly width: number;
    readonly height: number;
    readonly lights: readonly SegLight[];
  };
  /** Space between cells, in cell units. */
  readonly gap: number;
  readonly ends: Ends;
  /** How an unlit light's socket shows: a dark segment, or a hairline of wire. */
  readonly socket: 'segment' | 'wire';
  /** How far its lights bloom, as a multiple of an LED's. */
  readonly glow: number;
  readonly align: Align;
  /** The lit lights' names in each of `cells` cells. */
  encode(value: string | number, cells: number, align: Align): ReadonlySet<string>[];
  /**
   * The characters each of `cells` cells shows, '' for a blank, where a type spells letters or
   * numbers; a readout of such a type can be selected and copied as text.
   */
  text?(value: string | number, cells: number, align: Align): string[];
  /**
   * How a selected cell shows: its lights inverted, which reads on a grid of dots, or a block of the
   * selection color, where inverting would light every segment its character leaves dark. Default
   * `'block'`.
   */
  readonly selection?: 'invert' | 'block';
}

/** Fits `shown`, one entry per cell, into `cells`: numbers keep their last, text its first. */
export function fitCells<T>(shown: readonly T[], cells: number, align: Align, blank: T): T[] {
  if (cells <= 0) return [];
  const kept =
    shown.length > cells
      ? align === 'right'
        ? shown.slice(-cells)
        : shown.slice(0, cells)
      : [...shown];
  const pad = Array.from({ length: cells - kept.length }, () => blank);
  return align === 'right' ? [...pad, ...kept] : [...kept, ...pad];
}

const words = (s: string | undefined) => (s ? s.split(' ').filter(Boolean) : []);

/** The lights a `.`, `:` or `,` after a character lights on its cell instead of taking one. */
export interface Marks {
  readonly dp?: string;
  readonly colon?: string;
  readonly comma?: string;
}

const markOf = (marks: Marks): Record<string, string | undefined> => ({
  '.': marks.dp,
  ':': marks.colon,
  ',': marks.comma,
});

/** `value` split into the cells it takes: a character, and the marks lit on its cell after it. */
function tokens(value: string | number, mark: Record<string, string | undefined>): string[] {
  const out: string[] = [];
  for (const ch of String(value)) {
    const last = out.at(-1);
    if (mark[ch] && last !== undefined && !last.includes(ch)) out[out.length - 1] = last + ch;
    else out.push(ch);
  }
  return out;
}

/**
 * A type's coding over a character table, each character naming its lit lights space-separated. A
 * character the table lacks shows blank. Where a type has them, a `.`, `:` or `,` after a
 * character lights that cell's `dp`, `colon` or `comma` light instead of taking a cell.
 */
export function textCoding(
  table: Readonly<Record<string, string>>,
  marks: Marks = {},
): Pick<DisplayType, 'encode' | 'text'> {
  const mark = markOf(marks);
  return {
    encode: (value, cells, align) =>
      fitCells(
        tokens(value, mark).map((tok) => {
          const [ch = ''] = tok;
          const set = new Set(words(table[ch] ?? table[ch.toUpperCase()]));
          for (const c of tok) {
            const on = mark[c];
            if (on) set.add(on);
          }
          return set;
        }),
        cells,
        align,
        new Set<string>(),
      ),
    text: (value, cells, align) => fitCells(tokens(value, mark), cells, align, ''),
  };
}

/** `textCoding`'s encoder alone, for a type whose characters aren't text to copy. */
export const textEncoder = (
  table: Readonly<Record<string, string>>,
  marks: Marks = {},
): DisplayType['encode'] => textCoding(table, marks).encode;

/** Each character a cell, as a type that spells with no marks shows it. */
export const charText: NonNullable<DisplayType['text']> = (value, cells, align) =>
  fitCells([...String(value)], cells, align, '');
