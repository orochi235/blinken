import { type Board, board, type Led } from '../board.js';
import { ENDS, type Prims, primBuilder, SOCKET } from '../render/prims.js';
import type { DisplayType, Ends, SegLight } from './type.js';
import { half as HALF } from './types/segments.js';

/** What the layout needs of a readout. */
export interface Laid {
  readonly type: DisplayType;
  readonly cells: number;
  readonly face: 'plate' | 'none';
  readonly ends?: Ends;
  /** Whether a ½ digit leads the cells. */
  readonly half?: boolean;
  /** Whether each cell has a bar under it, unlit until something lights it. */
  readonly underline?: boolean;
  /** How many rows of cells it has, stacked; a ½ digit leads only the first. Default 1. */
  readonly lines?: number;
}

/** Where a readout's lights and shapes landed. */
export interface Spot {
  /** Its first row of the board: slot `s` of cell `k` is the dot `dotOf` gives. */
  readonly base: number;
  /** Cells in a row, a ½ digit's included: cell `k` is row `k / perLine`, column `k % perLine`. */
  readonly perLine: number;
  /** Board rows a row of cells takes: one per slot, an underline's included. */
  readonly lineSlots: number;
  /** The board column its first type cell sits in: 1 after a ½ digit, else 0. */
  readonly first: number;
  /** Its extent in local units, faceplate margin included, from (0, 0). */
  readonly width: number;
  readonly height: number;
  /** Each cell's box in local units, row by row, a ½ digit's first. */
  readonly cells: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  /** The slot of each cell's underline, or null where it has none. */
  readonly underline: number | null;
}

/** Every readout's lights as one board's dots, and the shapes that draw them, a view each. */
export interface Layout {
  readonly board: Board;
  readonly leds: readonly Led[];
  readonly prims: Prims;
  readonly spots: readonly Spot[];
}

/** The board index of slot `slot` of a readout's cell `k`, on a board `cols` wide. */
export const dotOf = (spot: Spot, cols: number, k: number, slot: number): number =>
  (spot.base + Math.floor(k / spot.perLine) * spot.lineSlots + slot) * cols + (k % spot.perLine);

/** How many rows of cells `r` has: a ½ digit keeps it to one. */
export const linesOf = (r: Laid): number => (r.half ? 1 : Math.max(1, Math.round(r.lines ?? 1)));

/** A faceplate's margin round a readout's cells, as a share of a cell's height. */
const MARGIN = 1 / 15;
/** Space between rows of cells, as a share of a cell's height. */
const LEADING = 1 / 4;
const CORNER = 1 / 30;

/**
 * Lays `readouts` out on one board: each a band of rows, one per slot, and a column per cell.
 * Board places no readout fills have no shapes, so nothing draws them.
 */
export function layOutReadouts(readouts: readonly Laid[]): Layout {
  const widthOf = (r: Laid) => r.cells + (r.half ? 1 : 0);
  const lightsOf = (r: Laid) =>
    Math.max(r.type.cell.lights.length, r.half ? HALF.cell.lights.length : 0);
  const lineSlotsOf = (r: Laid) => lightsOf(r) + (r.underline ? 1 : 0);
  const slotsOf = (r: Laid) => lineSlotsOf(r) * linesOf(r);
  const cols = Math.max(1, ...readouts.map(widthOf));
  const rows = Math.max(
    1,
    readouts.reduce((n, r) => n + slotsOf(r), 0),
  );
  const b = board(cols, rows, false);
  const out = primBuilder();
  const spots: Spot[] = [];
  let base = 0;
  for (const [v, r] of readouts.entries()) {
    const { cell } = r.type;
    const pad = cell.height * MARGIN;
    const socket =
      r.face === 'none' ? SOCKET.none : r.type.socket === 'wire' ? SOCKET.wire : SOCKET.segment;
    const ends = ENDS[r.ends ?? r.type.ends];
    let x = pad;
    let y = pad;
    let row = base;
    const place = (lights: readonly SegLight[], col: number, glow: number) => {
      for (const [slot, light] of lights.entries()) {
        const i = (row + slot) * cols + col;
        for (const s of light.shapes) {
          if (s.kind === 'disc') out.disc(i, v, socket, x + s.x, y + s.y, s.r, { glow });
          else if (s.kind === 'tri')
            out.tri(
              i,
              v,
              socket,
              s.points.map(([px, py]) => [x + px, y + py] as const),
              { glow },
            );
          else if (s.kind === 'bar')
            out.bar(i, v, socket, x + s.x1, y + s.y1, x + s.x2, y + s.y2, s.w / 2, ends, glow);
          else
            out.poly(
              i,
              v,
              socket,
              s.points.map(([px, py]) => [x + px, y + py] as const),
              s.w / 2,
              glow,
            );
        }
      }
    };
    const width = (cells: number) => cells * cell.width + Math.max(0, cells - 1) * r.type.gap;
    const total = (r.half ? HALF.cell.width + r.type.gap : 0) + width(r.cells) + pad * 2;
    const lines = linesOf(r);
    const leading = cell.height * LEADING;
    const height = lines * cell.height + (lines - 1) * leading + pad * 2;
    if (r.face === 'plate') out.plate(v, 0, 0, total, height, cell.height * CORNER);
    const boxes: Spot['cells'][number][] = [];
    const first = r.half ? 1 : 0;
    const perLine = first + r.cells;
    for (let l = 0; l < lines; l++) {
      x = pad;
      y = pad + l * (cell.height + leading);
      row = base + l * lineSlotsOf(r);
      if (r.half) {
        place(HALF.cell.lights, 0, r.type.glow);
        boxes.push({ x, y, width: HALF.cell.width, height: HALF.cell.height });
        x += HALF.cell.width + r.type.gap;
      }
      for (let c = 0; c < r.cells; c++) {
        place(cell.lights, first + c, r.type.glow);
        boxes.push({ x, y, width: cell.width, height: cell.height });
        x += cell.width + r.type.gap;
      }
    }
    const underline = r.underline ? lightsOf(r) : null;
    const spot: Spot = {
      base,
      first,
      perLine,
      lineSlots: lineSlotsOf(r),
      width: total,
      height,
      cells: boxes,
      underline,
    };
    if (underline !== null)
      for (const [k, b] of boxes.entries())
        out.bar(
          dotOf(spot, cols, k, underline),
          v,
          SOCKET.none,
          b.x + pad / 2,
          b.y + b.height + pad / 2,
          b.x + b.width - pad / 2,
          b.y + b.height + pad / 2,
          pad / 3,
          ENDS.round,
          r.type.glow,
        );
    spots.push(spot);
    base += slotsOf(r);
  }
  return { board: b, leds: b.dots, prims: out.build(), spots };
}
