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
 * in device pixels, with the canvas already sized.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  across: number,
  down: number,
  want: () => number | undefined,
  sized: (pitch: number) => void,
): Fit {
  const box = canvas.parentElement as HTMLElement;
  const refit = () => {
    const css = want() ?? Math.min(box.clientWidth / across, box.clientHeight / down);
    const w = Math.floor(css * across);
    const h = Math.floor(css * down);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
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
