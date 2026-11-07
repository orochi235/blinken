/** How one cell of a reel or flap readout looks. Colors are CSS colors; lengths are CSS pixels. */
export interface CellStyle {
  /** The glyphs' font family, as CSS names it. */
  readonly font: string;
  readonly weight: number | string;
  /** How tall a glyph stands, as a share of its cell's height. */
  readonly size: number;
  /** The glyphs' color. */
  readonly ink: string;
  /** The card's or drum's color. */
  readonly face: string;
  /** The color between and around the cells. */
  readonly housing: string;
  /** Room between cells, and around them all. */
  readonly gap: number;
  readonly padding: number;
  /** How round a card's or window's corners are. */
  readonly radius: number;
  /** A flap's hinge line across its middle, or null for none. */
  readonly split: string | null;
  /** How strongly a drum darkens toward its edges and a falling flap shades, 0 to 1. */
  readonly shade: number;
  /** How much of the glyphs above and below a reel's window shows, as a share of a glyph. */
  readonly peek: number;
}

/** Each kind's look unless a readout or cell says otherwise. */
export const LOOKS = {
  reel: {
    font: 'ui-monospace, "SF Mono", Menlo, monospace',
    weight: 600,
    size: 0.62,
    ink: '#f2efe6',
    face: '#16161a',
    housing: '#0b0b0d',
    gap: 3,
    padding: 4,
    radius: 3,
    split: null,
    shade: 0.75,
    peek: 0.3,
  },
  flap: {
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 700,
    size: 0.7,
    ink: '#f4f1e8',
    face: '#202124',
    housing: '#0b0b0d',
    gap: 4,
    padding: 4,
    radius: 4,
    split: '#000',
    shade: 0.6,
    peek: 0,
  },
} as const satisfies Record<string, CellStyle>;

export type MechanicalKind = keyof typeof LOOKS;
