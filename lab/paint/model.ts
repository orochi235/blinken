import type { FaceName, GridName, Lamps } from '@/index.js';

/** A lit dot: its color, and how brightly it lights, 0 to 1. */
export interface Dot {
  hex: number;
  level: number;
}

/** What's painted: each lit dot's `"x,y"` and how it lights. */
export type Picture = Record<string, Dot>;

/** Text floating over the picture, its top left at dot `x`, `y`, until it is stamped down. */
export interface Stamp {
  id: string;
  text: string;
  face: FaceName;
  x: number;
  y: number;
  hex: number;
  level: number;
}

export interface Layout {
  cols: number;
  rows: number;
  grid: GridName;
}

/** The most columns a board can have. */
export const MAX_COLS = 200;

/**
 * `layout` moved onto `grid`, keeping its width: the triangle tiling sets its places half a pitch
 * apart, so it takes twice the columns.
 */
export function onGrid(layout: Layout, grid: GridName): Layout {
  const per = (g: GridName) => (g === 'triangles' ? 2 : 1);
  const cols = Math.round((layout.cols * per(grid)) / per(layout.grid));
  return { ...layout, grid, cols: Math.min(Math.max(cols, 4), MAX_COLS) };
}

/** The page's look for every light: sizes and gaps in CSS pixels, unless `fit` scales them to the page. */
export interface LampSettings {
  size: number;
  gap: number;
  fit: boolean;
  brightness: number;
  glow: number;
}

export const LAMPS: LampSettings = { size: 14, gap: 5, fit: true, brightness: 1, glow: 1 };

/** The sign's own terms for `s`: a diameter as a share of the pitch, and the pitch unless fitted. */
export function lampsOf(s: LampSettings): Lamps {
  const pitch = s.size + s.gap;
  return {
    size: s.size / pitch,
    pitch: s.fit ? undefined : pitch,
    brightness: s.brightness,
    glow: s.glow,
  };
}

export type Tool = 'paint' | 'shade' | 'erase' | 'text';
export const SHAPES = ['round', 'square', 'diamond', 'row', 'column'] as const;
export type Shape = (typeof SHAPES)[number];

export interface Brush {
  tool: Tool;
  hex: number;
  level: number;
  /** Across, in dots; 1 lights the dot under the pointer alone. */
  size: number;
  shape: Shape;
}

export const key = (x: number, y: number) => `${x},${y}`;

/** How far from its center a brush of `size` reaches, in pitches. */
export const reachOf = (size: number) => (size - 1) / 2 + 0.05;

/** Half a row's height on the hex grid, under which a line brush keeps to one row or column. */
const LINE = 0.45;

/** Whether a brush of `shape` and `size` covers a dot `dx`, `dy` pitches from its center. */
export function covers(shape: Shape, size: number, dx: number, dy: number): boolean {
  const r = reachOf(size);
  switch (shape) {
    case 'round':
      return Math.hypot(dx, dy) <= r;
    case 'square':
      return Math.max(Math.abs(dx), Math.abs(dy)) <= r;
    case 'diamond':
      return Math.abs(dx) + Math.abs(dy) <= r;
    case 'row':
      return Math.abs(dx) <= r && Math.abs(dy) < LINE;
    case 'column':
      return Math.abs(dy) <= r && Math.abs(dx) < LINE;
  }
}
