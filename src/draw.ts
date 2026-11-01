import type { Board, Led } from './board.js';
import { dotColor } from './color.js';
import { type Afflictions, afflict, afflictions, type Defect } from './defects.js';
import { GRIDS, type Grid } from './grid.js';
import { FADE, type Fade, type Ghost, ghosts, settle } from './optics.js';

/** The mix's columns for each light, in the order the sign was given them; `tint` holds four per light. */
export interface SignColumns {
  lit: Float64Array;
  gain: Float64Array;
  tint: Float64Array;
  hue: Float64Array;
  chroma: Float64Array;
  glow: Float64Array;
  invert: Float64Array;
}

/** How far a dot's light blooms: its radius times `glow`, nothing at 0. */
export function haloRadius(r: number, glow: number): number {
  return r * Math.max(glow, 0);
}

/** How lit a dot shows: `lit`, clamped to 0..1, swapped `invert` of the way toward dark or lit. */
export function shownLit(lit: number, invert: number): number {
  const on = Math.min(Math.max(lit, 0), 1);
  return on + Math.min(Math.max(invert, 0), 1) * (1 - 2 * on);
}

/** Fresh columns for `n` lights, every channel at rest. */
export function signColumns(n: number): SignColumns {
  return {
    lit: new Float64Array(n),
    gain: new Float64Array(n).fill(1),
    tint: new Float64Array(n * 4),
    hue: new Float64Array(n),
    chroma: new Float64Array(n).fill(1),
    glow: new Float64Array(n).fill(1),
    invert: new Float64Array(n),
  };
}

const CHANNELS = Object.keys(signColumns(0)) as (keyof SignColumns)[];

/**
 * Copies each border bulb's cell's pose from `cells`, the mix's columns for `b.cells`, into `cols`,
 * where the bulbs follow the dots as `createSign` was given them.
 */
export function paintBulbs(b: Board, cells: SignColumns, cols: SignColumns): void {
  const after = b.dots.length;
  for (let j = 0; j < b.bulbs.length; j++) {
    const c = b.cellOf[j] as number;
    for (const ch of CHANNELS) {
      const n = ch === 'tint' ? 4 : 1;
      cols[ch].set(cells[ch].subarray(c * n, c * n + n), (after + j) * n);
    }
  }
}

export interface Sign {
  /** Draws one frame from the mix's columns, `dt` ms after the last. */
  render(cols: SignColumns, fallback: number, dt: number): void;
  /** Replaces the sign's broken lights. */
  setDefects(defects: readonly Defect[]): void;
  /** Sets how fast its lights light and go dark. */
  setFade(fade: Fade): void;
  /** Sets how much an unlit dot shows of its lit row and column. */
  setGhost(ghost: Ghost): void;
  /** Sets how its lights are sized, spaced, lit and bloom. */
  setLamps(lamps: Lamps): void;
  /** Stops following its parent's size. */
  destroy(): void;
}

/** How a sign's lights look, all of them alike. Each is optional; left out, the default holds. */
export interface Lamps {
  /** A dot's diameter, as a share of the pitch; a border bulb is 7/6 of a dot. Default 0.72. */
  size?: number;
  /** CSS pixels from one dot to the next. Default: as large as fits the canvas's parent. */
  pitch?: number;
  /** Multiplies how brightly each light shows. Default 1. */
  brightness?: number;
  /** Multiplies how far each light blooms. Default 1; 0 blooms nothing. */
  glow?: number;
}

const hexCss = new Map<number, string>();
function css(hex: number): string {
  let s = hexCss.get(hex);
  if (s === undefined) {
    s = `#${hex.toString(16).padStart(6, '0')}`;
    hexCss.set(hex, s);
  }
  return s;
}

/**
 * The sign's extent on `grid`, in pitches: its top left corner, and how far it runs across and
 * down. A point `p` pitches in sits at `p - left` (or `- top`) of the canvas's pitch-sized units.
 */
export function frameOf(
  b: Board,
  grid: Grid = GRIDS.square,
): { left: number; top: number; across: number; down: number } {
  const dotsAt = b.dots.map((d) => grid(d.x, d.y));
  const pad = b.margin + 0.5;
  const left = Math.min(...dotsAt.map(([x]) => x)) - pad;
  const top = Math.min(...dotsAt.map(([, y]) => y)) - pad;
  const across = Math.max(...dotsAt.map(([x]) => x)) + pad - left;
  const down = Math.max(...dotsAt.map(([, y]) => y)) + pad - top;
  return { left, top, across, down };
}

/**
 * A sign drawn on `canvas`, each of `leds` at its place on `grid`; the mix's columns arrive in that
 * order. Unless `backed` is false its housing is painted dark, rather than left showing the page.
 */
export function createSign(
  canvas: HTMLCanvasElement,
  b: Board,
  leds: readonly Led[],
  backed = true,
  grid: Grid = GRIDS.square,
): Sign {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const glow = document.createElement('canvas');
  const gctx = glow.getContext('2d') as CanvasRenderingContext2D;
  const body = document.createElement('canvas');
  const bctx = body.getContext('2d') as CanvasRenderingContext2D;
  const housing = document.createElement('canvas');
  const shown = new Float64Array(leds.length);
  const ghost = new Float64Array(leds.length);
  let broken: Afflictions = afflictions(leds, []);
  let fade: Fade = FADE;
  let leak: Ghost = {};
  let lamps: Lamps = {};
  let clock = 0;
  let pitch = 0;

  const box = canvas.parentElement as HTMLElement;
  const at = leds.map((led) => grid(led.x, led.y));
  const { left, top, across, down } = frameOf(b, grid);

  /** Fits the sign in its box, as large as both of the box's sides allow. */
  function resize(): void {
    const css = lamps.pitch ?? Math.min(box.clientWidth / across, box.clientHeight / down);
    canvas.style.width = `${Math.floor(css * across)}px`;
    canvas.style.height = `${Math.floor(css * down)}px`;
    pitch = css * devicePixelRatio;
    for (const c of [canvas, glow, body, housing]) {
      c.width = Math.round(pitch * across);
      c.height = Math.round(pitch * down);
    }
    const hctx = housing.getContext('2d') as CanvasRenderingContext2D;
    if (backed) {
      hctx.fillStyle = '#0d0a08';
      hctx.fillRect(0, 0, housing.width, housing.height);
    }
    for (const [i, led] of leds.entries()) {
      const [x, y] = place(i);
      hctx.fillStyle = led.kind === 'bulb' ? '#2b2118' : '#21150f';
      hctx.beginPath();
      hctx.arc(x, y, radius(led), 0, Math.PI * 2);
      hctx.fill();
    }
  }

  const place = (i: number): [number, number] => {
    const [x, y] = at[i] as readonly [number, number];
    return [(x - left) * pitch, (y - top) * pitch];
  };
  const radius = (led: Led) => (pitch * (lamps.size ?? 0.72) * (led.kind === 'bulb' ? 7 : 6)) / 12;

  const watch = new ResizeObserver(resize);
  watch.observe(box);
  resize();

  return {
    render({ lit, gain, tint, hue, chroma, glow: halo, invert }, fallback, dt) {
      clock += dt;
      const bright = Math.max(lamps.brightness ?? 1, 0);
      const spread = Math.max(lamps.glow ?? 1, 0);
      gctx.clearRect(0, 0, glow.width, glow.height);
      bctx.clearRect(0, 0, body.width, body.height);
      for (let i = 0; i < leds.length; i++) {
        const target = afflict(broken, i, shownLit(lit[i] ?? 0, invert[i] ?? 0), clock);
        shown[i] = settle(shown[i] ?? 0, target, dt, fade);
      }
      ghosts(b, shown, leak, ghost);
      for (let i = 0; i < leds.length; i++) {
        const now = (shown[i] ?? 0) + (ghost[i] ?? 0) * (broken.scale[i] ?? 1);
        if (now < 0.02) continue;
        const led = leds[i] as Led;
        const shine = Math.min(now * Math.min(gain[i] ?? 1, 1) * bright, 1);
        const hex = dotColor(tint, i * 4, hue[i] ?? 0, chroma[i] ?? 1, fallback);
        const [x, y] = place(i);
        const r = radius(led);
        bctx.globalAlpha = shine;
        bctx.fillStyle = css(hex);
        bctx.beginPath();
        bctx.arc(x, y, r, 0, Math.PI * 2);
        bctx.fill();
        bctx.globalAlpha = shine * 0.55;
        bctx.fillStyle = '#fff4e0';
        bctx.beginPath();
        bctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
        bctx.fill();
        const bloom = haloRadius(r, (halo[i] ?? 1) * spread);
        if (bloom > 0) {
          gctx.globalAlpha = shine;
          gctx.fillStyle = css(hex);
          gctx.beginPath();
          gctx.arc(x, y, bloom, 0, Math.PI * 2);
          gctx.fill();
        }
      }
      bctx.globalAlpha = 1;
      gctx.globalAlpha = 1;

      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      // An unbacked housing covers nothing, so the last frame's glow is cleared first.
      if (!backed) ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(housing, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${(pitch * 0.9 * spread).toFixed(1)}px)`;
      ctx.drawImage(glow, 0, 0);
      ctx.filter = 'none';
      ctx.drawImage(body, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    },
    setDefects(defects) {
      broken = afflictions(leds, defects);
    },
    setFade(next) {
      fade = next;
    },
    setGhost(next) {
      leak = next;
    },
    setLamps(next) {
      lamps = next;
      resize();
    },
    destroy() {
      watch.disconnect();
    },
  };
}
