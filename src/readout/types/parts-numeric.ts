import { type DisplayType, type SegLight, type SegShape, textCoding } from '../type.js';
import { bar, disc, light, type Point, range } from './kit.js';
import { seven } from './segments.js';

/**
 * These parts take no decoder: their datasheets name segments a to g and a decimal point, so each
 * shows what blinken's seven-segment type shows, read back from `seven` itself.
 */
export const PART_SEVEN: Readonly<Record<string, string>> = Object.fromEntries(
  [...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), '°'].flatMap((ch) => {
    const lit = [...(seven.spell?.lights(ch) ?? [])];
    const segs = lit.every((s) => 'abcdefg'.includes(s));
    return seven.spell?.shown?.(ch) === ch && segs && (lit.length > 0 || ch === ' ')
      ? [[ch, lit.join(' ')]]
      : [];
  }),
);

const coding = textCoding(PART_SEVEN, { dp: 'dp' });

/**
 * A digit's frame: its verticals' centers `x0` and `x1` at the baseline, rows `a`, `g` and `d` at
 * 1, 9 and 17, leaning right by `slant` per unit of height.
 */
interface Frame {
  readonly x0: number;
  readonly x1: number;
  readonly slant: number;
}

const lean =
  ({ slant }: Frame) =>
  (x: number, y: number): Point => [x + (17 - y) * slant, y];

/** A square `s` wide centered at (x, y), as a square-ended bar. */
const square = (x: number, y: number, s: number): SegShape => bar(x - s / 2, y, x + s / 2, y, s);

/** Seven solid strokes `w` wide, each stopping `gap` short of the corners it meets. */
function strokes(f: Frame, w: number, gap: number): SegLight[] {
  const at = lean(f);
  const i = w / 2 + gap;
  const h = (name: string, y: number) =>
    light(name, bar(...at(f.x0 + i, y), ...at(f.x1 - i, y), w));
  const v = (name: string, x: number, y0: number, y1: number) =>
    light(name, bar(...at(x, y0 + i), ...at(x, y1 - i), w));
  return [
    h('a', 1),
    v('b', f.x1, 1, 9),
    v('c', f.x1, 9, 17),
    h('d', 17),
    v('e', f.x0, 9, 17),
    v('f', f.x0, 1, 9),
    h('g', 9),
  ];
}

/** Seven segments of `n` square dots `s` wide, `pitch` apart, centered on each side. */
function dotted(f: Frame, n: number, pitch: number, s: number): SegLight[] {
  const at = lean(f);
  const run = (from: number, to: number) =>
    range(n).map((k) => (from + to) / 2 + (k - (n - 1) / 2) * pitch);
  const h = (name: string, y: number) =>
    light(name, ...run(f.x0, f.x1).map((x) => square(...at(x, y), s)));
  const v = (name: string, x: number, y0: number, y1: number) =>
    light(name, ...run(y0, y1).map((y) => square(...at(x, y), s)));
  return [
    h('a', 1),
    v('b', f.x1, 1, 9),
    v('c', f.x1, 9, 17),
    h('d', 17),
    v('e', f.x0, 9, 17),
    v('f', f.x0, 1, 9),
    h('g', 9),
  ];
}

const family = {
  ends: 'square',
  socket: 'segment',
  glow: 1,
  align: 'right',
} as const;

const DL330M: Frame = { x0: 1, x1: 11.3, slant: 0.062 };

/**
 * Litronix DL-330M: three wide, slightly slanted digits under round magnifier bubbles, the strokes
 * meeting at the corners and a round decimal point resting on the baseline.
 */
export const dl330m: DisplayType = {
  name: 'dl330m',
  cell: {
    width: 18.5,
    height: 18,
    lights: [...strokes(DL330M, 1.1, 0), light('dp', disc(17.2, 15.9, 1.1))],
  },
  gap: 13.2,
  color: 0xff2a1a,
  ...family,
  ...coding,
};

const HP7415: Frame = { x0: 1, x1: 9, slant: 0.076 };

/**
 * HP 5082-7415: five narrow, slightly slanted digits of hairline strokes under bubble lenses, its
 * square decimal point well below and right of the digit.
 */
export const hp50827415: DisplayType = {
  name: 'hp50827415',
  cell: {
    width: 14.5,
    height: 23,
    lights: [...strokes(HP7415, 0.8, 0.15), light('dp', square(13.3, 21.4, 1.9))],
  },
  gap: 9.2,
  color: 0xff1c10,
  ...family,
  ...coding,
};

const DL34: Frame = { x0: 1, x1: 10.25, slant: 0.18 };

/**
 * DL-34: four italic digits drawn in square dots, four to a segment, with a larger square decimal
 * point on the baseline.
 */
export const dl34: DisplayType = {
  name: 'dl34',
  cell: {
    width: 17.5,
    height: 18,
    lights: [...dotted(DL34, 4, 1.42, 1.05), light('dp', square(16.3, 16.8, 1.7))],
  },
  gap: 8.3,
  color: 0xff1c10,
  ...family,
  ...coding,
};
