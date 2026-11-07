import { type DisplayType, type SegLight, type SegShape, textCoding } from '../type.js';
import { sixteen } from './alpha.js';
import { disc, light } from './bars.js';

// The DL-2416's die has the starburst's segments, named as `sixteen` names them, but is wider
// and leans slightly, and its decimal point sits inside the cell beside the lower vertical.

const WIDEN = 1.6;
const LEAN = 0.05;

const place = ([x, y]: readonly [number, number]): [number, number] => [
  1 + (x - 1) * WIDEN + LEAN * (9 - y),
  y,
];

function placed(s: SegShape): SegShape {
  switch (s.kind) {
    case 'disc': {
      const [x, y] = place([s.x, s.y]);
      return { ...s, x, y };
    }
    case 'bar': {
      const [x1, y1] = place([s.x1, s.y1]);
      const [x2, y2] = place([s.x2, s.y2]);
      return { ...s, x1, y1, x2, y2 };
    }
    default:
      return { ...s, points: s.points.map(place) };
  }
}

const SEGMENTS: readonly SegLight[] = sixteen.cell.lights
  .filter((l) => l.name !== 'dp')
  .map((l) => light(l.name, ...l.shapes.map(placed)));

// The datasheet's 64 characters, 0x20–0x5F. `.` and `,` take a cell of their own, as on the part.
const DL2416: Readonly<Record<string, string>> = {
  ' ': '',
  '!': 'i dp',
  '"': 'f i',
  '#': 'b c d1 d2 g1 g2 i l',
  $: 'a1 a2 c d1 d2 f g1 g2 i l',
  '%': 'a1 c d2 f g1 g2 i j k l',
  '&': 'a1 c d1 d2 e g1 h i m',
  "'": 'j',
  '(': 'j m',
  ')': 'h k',
  '*': 'g1 g2 h i j k l m',
  '+': 'g1 g2 i l',
  ',': 'k',
  '-': 'g1 g2',
  '.': 'dp',
  '/': 'j k',
  '0': 'a1 a2 b c d1 d2 e f',
  '1': 'b c',
  '2': 'a1 a2 b d1 d2 e g1 g2',
  '3': 'a1 a2 b c d1 d2 g2',
  '4': 'b c f g1 g2',
  '5': 'a1 a2 c d1 d2 f g1 g2',
  '6': 'a1 a2 c d1 d2 e f g1 g2',
  '7': 'a1 a2 b c',
  '8': 'a1 a2 b c d1 d2 e f g1 g2',
  '9': 'a1 a2 b c d1 d2 f g1 g2',
  ':': 'a1 a2 d1 d2',
  ';': 'a1 a2 k',
  '<': 'd1 d2 j k',
  '=': 'd1 d2 g1 g2',
  '>': 'd1 d2 h m',
  '?': 'a1 a2 b g2 l',
  '@': 'a1 a2 b c d1 d2 e g1 l',
  A: 'a1 a2 b c e f g1 g2',
  B: 'a1 a2 b c d1 d2 g2 i l',
  C: 'a1 a2 d1 d2 e f',
  D: 'a1 a2 b c d1 d2 i l',
  E: 'a1 a2 d1 d2 e f g1',
  F: 'a1 a2 e f g1',
  G: 'a1 a2 c d1 d2 e f g2',
  H: 'b c e f g1 g2',
  I: 'a1 a2 d1 d2 i l',
  J: 'a1 a2 d1 e i l',
  K: 'e f g1 j m',
  L: 'd1 d2 e f',
  M: 'b c e f h j',
  N: 'b c e f h m',
  O: 'a1 a2 b c d1 d2 e f',
  P: 'a1 a2 b e f g1 g2',
  Q: 'a1 a2 b c d1 d2 e f m',
  R: 'a1 a2 b e f g1 g2 m',
  S: 'a1 a2 c d1 d2 f g1 g2',
  T: 'a1 a2 i l',
  U: 'b c d1 d2 e f',
  V: 'e f j k',
  W: 'b c e f k m',
  X: 'h j k m',
  Y: 'h j l',
  Z: 'a1 a2 d1 d2 j k',
  '[': 'a1 d1 e f',
  '\\': 'h m',
  ']': 'a2 b c d2',
  '^': 'k m',
  _: 'd1 d2',
};

/** The Siemens DL-2416 (HP's HPDL-2416): four 16-segment LEDs with a decimal point each. */
export const dl2416: DisplayType = {
  name: 'dl2416',
  cell: {
    width: 15,
    height: 18,
    lights: [...SEGMENTS, light('dp', disc(...place([5.9, 16.2]), 0.45))],
  },
  gap: 9,
  ends: 'square',
  socket: 'segment',
  color: 0xff2a1a,
  glow: 1,
  align: 'left',
  ...textCoding(DL2416),
};
