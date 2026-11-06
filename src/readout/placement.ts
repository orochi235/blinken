import { type Placement, VIEW } from '../render/placement.js';
import type { Spot } from './layout.js';

/** Where a readout goes, in the canvas's CSS pixels: a box its cells are fitted in, and a clip. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly clip: {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  };
}

/** A readout as its placement sees it: where its layout put it, and where it should go now. */
export interface Placed {
  spot: Spot;
  readonly slant: number;
  /** Its box this frame, or null where it shows nowhere. */
  box(): Box | null;
}

/** How a surface's canvas is sized and watched. */
export interface Canvas {
  /** Its size in CSS pixels. */
  size(canvas: HTMLCanvasElement): { width: number; height: number };
  /** Calls `resized` whenever its size may have changed; gives a stop. */
  watch(canvas: HTMLCanvasElement, resized: () => void): () => void;
  /** Whether it is fixed over the viewport, so text laid over it is too. */
  readonly fixed?: boolean;
}

/**
 * Where a readout is drawn, in CSS pixels: local (x, y) lands at
 * `(left + (x - y * slant) * scale, top + y * scale)`, and nothing shows outside `clip`.
 */
export interface Fit {
  readonly left: number;
  readonly top: number;
  readonly scale: number;
  readonly slant: number;
  readonly clip: Box['clip'];
}

/** `r` fitted in its box this frame, aspect kept and centered; null where it shows nowhere. */
export function fitOf(r: Placed): Fit | null {
  const box = r.box();
  if (!box) return null;
  const { width, height } = r.spot;
  const slanted = width + height * r.slant;
  const scale = Math.min(box.width / slanted, box.height / height);
  if (!(scale > 0)) return null;
  const spare = (span: number, used: number) => (Number.isFinite(span) ? (span - used) / 2 : 0);
  const c = box.clip;
  if (!(c.x1 > c.x0 && c.y1 > c.y0)) return null;
  return {
    left: box.x + spare(box.width, slanted * scale) + height * r.slant * scale,
    top: box.y + spare(box.height, height * scale),
    scale,
    slant: r.slant,
    clip: c,
  };
}

/** A surface's placement, which also keeps each readout's fit from its last fill. */
export type SurfacePlacement = Placement & { readonly fits: readonly (Fit | null)[] };

/** One view per readout, each fitted in its box with its aspect kept, centered, and clipped. */
export function surfacePlacement(
  readouts: () => readonly Placed[],
  sizing: Canvas,
): SurfacePlacement {
  let views = new Float32Array(VIEW);
  let fits: (Fit | null)[] = [];
  let target: HTMLCanvasElement | null = null;
  /** Whether the views were filled since the sign last drew them. */
  let stale = false;
  const fill = (): boolean => {
    const list = readouts();
    const next = new Float32Array(Math.max(1, list.length) * VIEW);
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    fits = list.map(fitOf);
    for (const [v, f] of fits.entries()) {
      if (!f) continue;
      const c = f.clip;
      next.set(
        [
          f.left * dpr,
          f.top * dpr,
          f.scale * dpr,
          f.slant,
          c.x0 * dpr,
          c.y0 * dpr,
          c.x1 * dpr,
          c.y1 * dpr,
        ],
        v * VIEW,
      );
    }
    const moved = next.length !== views.length || next.some((x, i) => x !== views[i]);
    views = next;
    return moved;
  };
  const self = {
    get views() {
      return views;
    },
    get fits() {
      return fits;
    },
    pitch: 0,
    blur: false,
    start(canvas: HTMLCanvasElement, changed: () => void) {
      target = canvas;
      const resized = () => {
        const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
        const { width, height } = sizing.size(canvas);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        fill();
        changed();
      };
      const stop = sizing.watch(canvas, resized);
      resized();
      return () => {
        stop();
        target = null;
      };
    },
    update() {
      const moved = fill() || stale;
      stale = false;
      return moved;
    },
    refit() {
      stale = true;
      if (target) fill();
    },
  };
  return self;
}
