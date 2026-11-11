/** The longest side a 2D canvas can safely take, in device pixels; Safari's limit, the least. */
export const CANVAS_LIMIT = 16384;

/**
 * The pixel ratio a canvas `width` × `height` CSS pixels draws at: the screen's, less where that
 * would pass `limit` device pixels a side, which the backend can't draw. Says so once per `canvas`.
 */
export function ratioFor(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  limit: number,
): number {
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  const most = Math.min(dpr, limit / Math.max(width, 1), limit / Math.max(height, 1));
  if (most >= dpr) return dpr;
  if (!warned.has(canvas)) {
    warned.add(canvas);
    console.warn(
      `blinken: a ${Math.round(width)} × ${Math.round(height)} canvas passes ${limit} device pixels a side at a pixel ratio of ${dpr}, so it draws at ${most.toFixed(2)}`,
    );
  }
  return most;
}
const warned = new WeakSet<HTMLCanvasElement>();

/** A canvas kept fitted to its parent box. */
export interface Fit {
  /** Fits it again now, as after a change to the pitch asked for. */
  refit(): void;
  /** Stops following the box and the pixel ratio. */
  stop(): void;
}

/**
 * Keeps `canvas` fitted in its parent, `across` × `down` pitches, as large as both of the box's
 * sides allow unless `want()` gives a pitch in CSS pixels. After each fit, `sized` gets the pitch
 * in device pixels, with the canvas already sized, at no more than `limit` device pixels a side.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  across: number,
  down: number,
  want: () => number | undefined,
  sized: (pitch: number) => void,
  limit = CANVAS_LIMIT,
): Fit {
  const box = canvas.parentElement as HTMLElement;
  const refit = () => {
    const css = want() ?? Math.min(box.clientWidth / across, box.clientHeight / down);
    const w = Math.floor(css * across);
    const h = Math.floor(css * down);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ratio = ratioFor(canvas, w, h, limit);
    canvas.width = Math.min(limit, Math.round(w * ratio));
    canvas.height = Math.min(limit, Math.round(h * ratio));
    sized(Math.min(canvas.width / across, canvas.height / down));
  };
  const watch = new ResizeObserver(refit);
  watch.observe(box);
  // A move to a screen of another pixel ratio resizes nothing, so the ratio is watched too.
  let ratio: MediaQueryList | null = null;
  const onRatio = () => {
    refit();
    followRatio();
  };
  const followRatio = () => {
    ratio?.removeEventListener('change', onRatio);
    ratio =
      typeof matchMedia === 'function' ? matchMedia(`(resolution: ${devicePixelRatio}dppx)`) : null;
    ratio?.addEventListener('change', onRatio);
  };
  followRatio();
  refit();
  return {
    refit,
    stop() {
      watch.disconnect();
      ratio?.removeEventListener('change', onRatio);
    },
  };
}
