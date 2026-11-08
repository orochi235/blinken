import type { Fit } from './placement.js';
import type { One } from './text-cells.js';

/**
 * Moves each readout's boxes in `layer` to its fit, and a panel's layer over its `canvas`; an
 * overlay's, with no canvas, is fixed over the viewport already.
 */
export function placeAll(
  layer: HTMLElement,
  canvas: HTMLCanvasElement | null,
  readouts: readonly (One | null)[],
  fits: readonly (Fit | null)[],
): void {
  if (canvas) {
    const box = `${canvas.offsetLeft} ${canvas.offsetTop} ${canvas.offsetWidth} ${canvas.offsetHeight}`;
    if (box !== layer.dataset.box) {
      layer.dataset.box = box;
      Object.assign(layer.style, {
        left: `${canvas.offsetLeft}px`,
        top: `${canvas.offsetTop}px`,
        width: `${canvas.offsetWidth}px`,
        height: `${canvas.offsetHeight}px`,
      });
    }
  }
  const w = layer.clientWidth;
  const h = layer.clientHeight;
  for (const [i, r] of readouts.entries()) {
    if (!r) continue;
    const f = fits[i] ?? null;
    const at = f ? JSON.stringify([f, w, h]) : '';
    if (at === r.at) continue;
    r.at = at;
    r.group.hidden = !f;
    if (!f) continue;
    // The group covers the readout's whole box and takes the pointer, so a drag ending between
    // its cells lands in them rather than in whatever text the page has elsewhere.
    const { width, height } = r.spot;
    const gx = f.left - height * f.slant * f.scale;
    const gy = f.top;
    const gw = (width + height * f.slant) * f.scale;
    const gh = height * f.scale;
    const c = f.clip;
    Object.assign(r.group.style, {
      left: `${gx}px`,
      top: `${gy}px`,
      width: `${gw}px`,
      height: `${gh}px`,
      clipPath: `inset(${c.y0 - gy}px ${gx + gw - c.x1}px ${gy + gh - c.y1}px ${c.x0 - gx}px)`,
    });
    const skew = `skewX(${-Math.atan(f.slant)}rad)`;
    for (const [k, cell] of r.cells.entries()) {
      const b = r.spot.cells[k];
      if (!b) continue;
      const tall = b.height * f.scale;
      Object.assign(cell.style, {
        left: `${f.left - gx + (b.x - b.y * f.slant) * f.scale}px`,
        top: `${b.y * f.scale}px`,
        width: `${b.width * f.scale}px`,
        height: `${tall}px`,
        fontSize: `${tall * 0.8}px`,
        lineHeight: `${tall}px`,
        transform: f.slant ? skew : '',
      });
    }
  }
}
