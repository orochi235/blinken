import { type ShaderPatch, type ShaderSpec, shaderPatch } from '@msb235/blits/gpu';
import type { Pose, Subject } from '../board.js';
import {
  type Bound,
  FIELDS,
  type Given,
  HELPERS,
  hasTables,
  recent,
  type Tables,
} from '../modulators/shader.js';
import type { Placed } from '../orders.js';

/** A move's pass as a shader patch, writing `lit` on every dot and 0 on every cell. */
export type MoveShader = ShaderPatch<Subject, Pose, Bound>;

/** A table's size and its contents row by row. */
export interface Table {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

/** The message's levels, and the text row each dot row shows plus 1 (0 for none), as tables. */
export interface BitmapTables {
  readonly bitmap: Float32Array;
  readonly rows: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly rowsLen: number;
}

const placedTables = new WeakMap<Placed, BitmapTables>();

/** `at`'s text and row map as the tables every move shader reads; a table is at least 1 × 1. */
export function bitmapTables(at: Placed): BitmapTables {
  const had = placedTables.get(at);
  if (had) return had;
  const width = Math.max(1, at.text.cols);
  const height = Math.max(1, at.text.rows);
  const bitmap = new Float32Array(width * height);
  for (let y = 0; y < at.text.rows; y++)
    for (let x = 0; x < at.text.cols; x++) bitmap[y * width + x] = at.text.level(x, y);
  const rowsLen = at.board.rows + at.text.rows;
  const rows = Float32Array.from(
    { length: rowsLen },
    (_, y) => at.rowOf({ kind: 'dot', x: 0, y }) + 1,
  );
  const made = { bitmap, rows, width, height, rowsLen };
  placedTables.set(at, made);
  return made;
}

/**
 * WGSL for `litAt`: how brightly the message, its left edge at column `x0` and moved `dy` rows
 * down, lights the dot, reading `row`, the text row the dot shows.
 */
export const LIT = (x0: string, dy = '0.0') =>
  `select(0.0, table_bitmap(subject.x - (${x0}), row - (${dy})), row >= 0.0)`;

/** `LIT` in JS, reading the same tables. */
export function litOf(t: Tables, d: { x: number; y: number }, x0: number, dy = 0): number {
  const row = (t.rows as Tables[string])(0, d.y) - 1;
  return row >= 0 ? (t.bitmap as Tables[string])(d.x - x0, row - dy) : 0;
}

/** WGSL for `Math.round`, which rounds halves up where WGSL's `round` rounds them to even. */
export const ROUND = (x: string) => `floor((${x}) + 0.5)`;

/** What `moveShader` takes: a move's pass for one dot, written twice. */
export interface MoveSpec {
  /**
   * WGSL statements setting `lit` for a dot, from `phase`, `subject`, `params.<name>`, `row` (the
   * text row the dot shows, or -1) and the tables.
   */
  readonly wgsl: string;
  /** The names of the numbers it reads, as `params.<name>` in WGSL. */
  readonly params: readonly string[];
  /** The same in JS: the dot's `lit`. */
  at(phase: number, dot: { x: number; y: number }, p: Bound, t: Tables): number;
}

/** Kernels kept per move, one for each duration and set of table sizes it is cued at. */
const KEEP = 16;

/**
 * A move's shader on a placed message: cues of one duration and table sizes share a kernel, and
 * `with` gives each its numbers and tables. Null on a blits whose shader patches have no tables.
 */
export function moveShader(
  spec: MoveSpec,
): (
  at: Placed,
  duration: number,
  values: Bound,
  extra?: Record<string, Table>,
) => MoveShader | null {
  const kernels = recent<string, MoveShader>(KEEP);
  const params = Object.fromEntries(spec.params.map((n) => [n, 'f32' as const]));
  return (at, duration, values, extra = {}) => {
    if (!hasTables()) return null;
    const bt = bitmapTables(at);
    const tables: Record<string, Table> = {
      bitmap: { width: bt.width, height: bt.height, data: bt.bitmap },
      rows: { width: 1, height: bt.rowsLen, data: bt.rows },
      ...extra,
    };
    const sizes = Object.entries(tables).map(([n, t]) => `${n}${t.width}x${t.height}`);
    const kernel = kernels(`${duration} ${sizes.join(' ')}`, () =>
      shaderPatch<Subject, Pose, Bound>(duration, {
        helpers: HELPERS,
        fields: FIELDS,
        params,
        tables: Object.fromEntries(
          Object.entries(tables).map(([n, t]) => [n, { width: t.width, height: t.height }]),
        ),
        wgsl: `var lit = 0.0;
if (subject.cell < 0.5) {
  let row = table_rows(0.0, subject.y) - 1.0;
  ${spec.wgsl}
}
out.lit = lit;`,
        at: (phase, s, _setting, v) => ({
          lit: s.kind === 'cell' ? 0 : spec.at(phase, s, v, v as unknown as Tables),
        }),
        writes: ['lit'],
      } as ShaderSpec<Subject, Pose, Bound>),
    );
    const given: Given = { ...values };
    for (const [n, t] of Object.entries(tables)) given[n] = t.data;
    return kernel.with(given as Bound);
  };
}
