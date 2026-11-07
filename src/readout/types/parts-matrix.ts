import { type DisplayType, type SegLight, type SegShape, textCoding } from '../type.js';
import { sixteen } from './alpha.js';
import { bar, disc, light, range } from './kit.js';

// HP's 5 × 7 font, codes 0x00–0x7F eight to a line, each glyph its five columns left to right as
// hex bytes, bit 0 the top row: the HDSP-211x's character ROM, read from its datasheet's table.
const HP_HEX = `
081c3e7f00 3048454030 4529112945 7d0911217d 7d09050579 3844443844 7e01292e10 304a4d4930
6050485060 1e04043840 3e4949493e 6214081060 403c20201c 087c047c02 3844443c04 4163554941
1008780804 18247e2418 5e6101615e 7814151478 3844453c40 7815141578 3845443d40 3c4342433c
3845444538 3c4140413c 3842404238 08082a1c08 207e020202 1219151200 487e494142 01127c1201
0000000000 005f000000 0003000300 147f147f14 242a7f2a12 2313086462 3649562050 000b070000
00003e4100 00413e0000 082a1c2a08 08083e0808 0058380000 0808080808 0030300000 2010080402
3e5149453e 00427f4000 6251494946 2241494936 1814127f10 2745454539 3c4a494930 0171090503
3649494936 064949291e 0036360000 005b3b0000 0008142241 1414141414 4122140800 0201510906
3e415d551e 7e0909097e 7f49494936 3e41414122 7f4141413e 7f49494941 7f09090901 3e41415132
7f0808087f 00417f4100 204040403f 7f08142241 7f40404040 7f020c027f 7f0408107f 3e4141413e
7f09090906 3e4151215e 7f09192946 2649494932 01017f0101 3f4040403f 0718601807 7f2018207f
6314081463 0304780403 6151494543 00007f4141 0204081020 41417f0000 04027f0204 4040404040
00070b0000 3844443c40 7f48444438 3844444420 384444487f 3854545408 087e090200 081454543c
7f08040478 00447d4000 2040443d00 007f102844 00417f4000 7804180478 7c08040478 3844444438
7c14242418 1824147c40 007c080404 4854545420 043e442000 3c4040207c 1c2040201c 3c4030403c
4428102844 0448300804 4464544c44 0008364100 0000770000 0041360800 0804081008 2a552a552a
`;

// What codes 0x00–0x1F and 0x7F show, as the characters they draw. 0x02 draws x̄, which no single
// character spells, so it is left out.
const SPECIALS = '◀¿\0ÑñαβδΔηθλμπσΣτφΩÅåÄäÖöÜü→√²£¥';
const CODES = [...SPECIALS, ...range(95).map((i) => String.fromCharCode(32 + i)), '▒'];

/** Each column's lit rows, as `matrix` names its dots: `x,y`. */
const dotsOf = (hex: string): string =>
  range(5)
    .flatMap((x) => {
      const col = Number.parseInt(hex.slice(x * 2, x * 2 + 2), 16);
      return range(7).flatMap((y) => ((col >> y) & 1 ? [`${x},${y}`] : []));
    })
    .join(' ');

const HP: Readonly<Record<string, string>> = Object.fromEntries(
  HP_HEX.trim()
    .split(/\s+/)
    .flatMap((hex, code) => (CODES[code] === '\0' ? [] : [[CODES[code], dotsOf(hex)]])),
);

/**
 * The HDSP-2000 has no character ROM: its application note's decoder table drives it, and that
 * table draws `?` and `G` a dot apart from the HDSP-211x's ROM.
 */
const HDSP2000_FONT: Readonly<Record<string, string>> = {
  ...HP,
  '?': dotsOf('0601510906'),
  G: dotsOf('3e41415172'),
};

/** A 5 × 7 grid of dots `dx` by `dy` apart, each drawn by `dot` at its center. */
const grid = (dx: number, dy: number, dot: (x: number, y: number) => SegShape): SegLight[] =>
  range(7).flatMap((y) =>
    range(5).map((x) => light(`${x},${y}`, dot(dx * (x + 0.5), dy * (y + 0.5)))),
  );

const dotMatrix = {
  socket: 'segment',
  glow: 1,
  align: 'left',
  selection: 'invert',
} as const;

/**
 * HP's HDSP-2000: four 5 × 7 characters of square red LED dies, rows a little farther apart than
 * columns, behind a red filter. Its characters are its application note's 128.
 */
export const hdsp2000: DisplayType = {
  name: 'hdsp2000',
  cell: {
    width: 10,
    height: 7 * 2.3,
    lights: grid(2, 2.3, (x, y) => bar(x - 0.6, y, x + 0.6, y, 1.2)),
  },
  gap: 8,
  ends: 'square',
  color: 0xff1c10,
  ...dotMatrix,
  ...textCoding(HDSP2000_FONT),
};

/**
 * HP's HDSP-211x: eight 5 × 7 characters of small round dots on a square pitch, with the 128
 * characters of its ROM. Red, as the HDSP-2112; the HDSP-2110, -2111 and -2113 are orange, yellow
 * and green.
 */
export const hdsp211x: DisplayType = {
  name: 'hdsp211x',
  cell: { width: 10, height: 14, lights: grid(2, 2, (x, y) => disc(x, y, 0.5)) },
  gap: 4.9,
  ends: 'round',
  color: 0xff3a1a,
  ...dotMatrix,
  ...textCoding(HP),
};

// Named as `sixteen` names its segments. Its digits are narrow, drawn in the left half alone.
const DL3416_FONT: Readonly<Record<string, string>> = {
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
  '0': 'a1 d1 e f i l',
  '1': 'i l',
  '2': 'a1 d1 e g1 i',
  '3': 'a1 d1 g1 i l',
  '4': 'f g1 i l',
  '5': 'a1 d1 f g1 l',
  '6': 'a1 d1 e f g1 l',
  '7': 'a1 i l',
  '8': 'a1 d1 e f g1 i l',
  '9': 'a1 d1 f g1 i l',
  ':': 'a1 d1',
  ';': 'a1 k',
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
  J: 'b c d1 d2 e',
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

const WIDEN = 1.3;

const widened = (s: SegShape): SegShape =>
  s.kind === 'bar'
    ? { ...s, x1: s.x1 * WIDEN, x2: s.x2 * WIDEN }
    : s.kind === 'disc'
      ? { ...s, x: s.x * WIDEN }
      : { ...s, points: s.points.map(([x, y]) => [x * WIDEN, y] as const) };

/**
 * The Siemens DL-3416: four 16-segment red LEDs under bubble lenses, a decimal point beside each
 * lower vertical, showing ASCII 0x20–0x5F.
 */
export const dl3416: DisplayType = {
  name: 'dl3416',
  cell: {
    width: 10 * WIDEN,
    height: 18,
    lights: [
      ...sixteen.cell.lights
        .filter((l) => l.name !== 'dp')
        .map((l) => light(l.name, ...l.shapes.map(widened))),
      light('dp', disc(6 * WIDEN, 15.6, 0.5)),
    ],
  },
  gap: 10,
  ends: 'square',
  socket: 'segment',
  color: 0xff2a1a,
  glow: 1,
  align: 'left',
  ...textCoding(DL3416_FONT),
};
