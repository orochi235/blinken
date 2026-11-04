import type { Board, Led } from '../board.js';
import { frameOf, type Grid } from '../grid.js';

export const SHAPES = { dot: 0, bulb: 1 } as const;
export type ShapeName = keyof typeof SHAPES;

/** How a light's lens is painted: its color, with a pale core over the center. */
export interface Material {
  readonly name: 'led';
  /** The core's radius, as a share of the light's. */
  readonly core: number;
  /** The core's color. */
  readonly coreTint: number;
  /** The core's opacity at full shine. */
  readonly coreAlpha: number;
}

export const LED: Material = { name: 'led', core: 0.45, coreTint: 0xfff4e0, coreAlpha: 0.55 };

/** Where each light sits and how big it is, in pitches, in the order the sign was given its lights. */
export interface LightTable {
  readonly n: number;
  /** x, y per light, from the frame's top left. */
  readonly at: Float32Array;
  /** A `SHAPES` value per light. */
  readonly shape: Uint32Array;
  /** Before `lamps.size` is applied. */
  readonly radius: Float32Array;
  readonly frame: { across: number; down: number };
}

/** A light's radius in pitches, before `lamps.size` is applied. */
export function radiusOf(kind: Led['kind']): number {
  return (kind === 'bulb' ? 7 : 6) / 12;
}

/** The table for `leds` on `b`, placed by `grid`. */
export function lightTable(b: Board, leds: readonly Led[], grid: Grid): LightTable {
  const { left, top, across, down } = frameOf(b, grid);
  const at = new Float32Array(leds.length * 2);
  const shape = new Uint32Array(leds.length);
  const radius = new Float32Array(leds.length);
  for (const [i, led] of leds.entries()) {
    const [x, y] = grid(led.x, led.y);
    at[i * 2] = x - left;
    at[i * 2 + 1] = y - top;
    shape[i] = SHAPES[led.kind];
    radius[i] = radiusOf(led.kind);
  }
  return { n: leds.length, at, shape, radius, frame: { across, down } };
}
