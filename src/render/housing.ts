import { rgb } from '../color.js';
import {
  BULB_COLOR,
  DOT_COLOR,
  HOUSING,
  PLATE_COLOR,
  SEGMENT_COLOR,
  WIRE_COLOR,
} from './bloom-params.js';
import { SOCKET } from './prims.js';

/**
 * What a sign shows round its lights: `dark` paints the housing and its sockets, `clear` leaves the
 * housing see-through and draws each socket as a faint veil, as faint over a white page as over a
 * black one, and `none` draws neither, so only lit light shows over the page and an unlit dot is
 * simply absent.
 */
export type Housing = 'dark' | 'clear' | 'none';

export const HOUSINGS: readonly Housing[] = ['dark', 'clear', 'none'];

/** Premultiplied r, g, b, a, 0..1. */
export type Rgba = readonly [number, number, number, number];

/** What every backend paints for a housing. */
export interface HousingPaint {
  /** The color behind everything, or null where the page shows through. */
  readonly backing: number | null;
  /** Each socket's premultiplied color, by `SOCKET` value, or null where sockets don't show. */
  readonly sockets: readonly Rgba[] | null;
  /** Paints nothing at all, so a backend can skip compositing the housing. */
  readonly blank: boolean;
  /**
   * How lights meet the housing: `add` onto the dark backing, or `over` it, laid on top once they
   * have added up among themselves, where adding to a translucent socket would wash a light out.
   */
  readonly lights: 'add' | 'over';
}

/** A socket's color by `SOCKET` value on the dark housing. */
const DARK_SOCKETS: Readonly<Record<number, number>> = {
  [SOCKET.dot]: DOT_COLOR,
  [SOCKET.bulb]: BULB_COLOR,
  [SOCKET.segment]: SEGMENT_COLOR,
  [SOCKET.wire]: WIRE_COLOR,
  [SOCKET.plate]: PLATE_COLOR,
};
const SOCKETS = 6;

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const encode = (y: number) => (y <= 0.0031308 ? y * 12.92 : 1.055 * y ** (1 / 2.4) - 0.055);
/** CIE L* (0..100) of a color. */
export function lightness(hex: number): number {
  const [r, g, b] = rgb(hex).map(linear) as [number, number, number];
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}
/** The gray, as an sRGB channel, whose L* is `l`. */
function grayOf(l: number): number {
  const y = l > 8 ? ((l + 16) / 116) ** 3 : (27 / 24389) * l;
  return encode(y);
}

/**
 * A translucent gray that lifts black and darkens white by the same `delta` of L*. Pages composite
 * in sRGB, so over black it shows `a·g` and over white `1 − a·(1 − g)`; each fixes one product.
 */
export function veil(delta: number): Rgba {
  const onBlack = grayOf(delta);
  const onWhite = 1 - grayOf(100 - delta);
  const a = Math.min(onBlack + onWhite, 1);
  return [onBlack, onBlack, onBlack, a];
}

/** Each socket as opaque on the dark housing, and as a veil standing out from the page as much. */
const dark: Rgba[] = [];
const clear: Rgba[] = [];
for (let s = 0; s < SOCKETS; s++) {
  const hex = DARK_SOCKETS[s] ?? HOUSING;
  dark.push([...rgb(hex), 1]);
  clear.push(veil(Math.max(lightness(hex) - lightness(HOUSING), 0)));
}

const PAINTS: Readonly<Record<Housing, HousingPaint>> = {
  dark: { backing: HOUSING, sockets: dark, blank: false, lights: 'add' },
  clear: { backing: null, sockets: clear, blank: false, lights: 'over' },
  none: { backing: null, sockets: null, blank: true, lights: 'over' },
};

/** What `housing` paints. */
export const housingPaint = (housing: Housing): HousingPaint => PAINTS[housing];

/** The color a GPU clears its housing target to: the backing, opaque, or transparent black. */
export function backingRgba(paint: HousingPaint): [number, number, number, number] {
  return paint.backing === null ? [0, 0, 0, 0] : [...rgb(paint.backing), 1];
}

/** Every socket's color as one flat array, four floats a socket, as the shaders read them. */
export const socketFloats = (paint: HousingPaint): Float32Array =>
  new Float32Array((paint.sockets ?? dark).flat());

/** A premultiplied socket color as CSS. */
export function cssOfRgba([r, g, b, a]: Rgba): string {
  const ch = (v: number) => Math.round(a > 0 ? (v / a) * 255 : 0);
  return `rgba(${ch(r)}, ${ch(g)}, ${ch(b)}, ${a.toFixed(4)})`;
}
