import { oklab } from '@msb235/blits';
import { board, createSign, frameOf, GRIDS, type GridName, signColumns } from '@/index.js';

/** What's painted: each lit dot's `"x,y"` and its color. */
export type Picture = Record<string, number>;

export interface Layout {
  cols: number;
  rows: number;
  grid: GridName;
}

export interface Brush {
  hex: number | null;
  /** Across, in dots; 1 lights the dot under the pointer alone. */
  size: number;
}

export interface Painter {
  setPicture(picture: Picture): void;
  destroy(): void;
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * A board of `layout` on `canvas`, lit as `picture` says and painted by dragging over it with
 * `brush()`; right-drag erases. Each finished stroke goes to `onPaint`.
 */
export function createPainter(
  canvas: HTMLCanvasElement,
  layout: Layout,
  picture: Picture,
  brush: () => Brush,
  onPaint: (picture: Picture) => void,
): Painter {
  const grid = GRIDS[layout.grid];
  const b = board(layout.cols, layout.rows, false);
  const sign = createSign(canvas, b, b.dots, true, grid);
  const cols = signColumns(b.dots.length);
  const at = b.dots.map((d) => grid(d.x, d.y));
  const frame = frameOf(b, grid);
  let shown: Picture = { ...picture };

  function light(): void {
    cols.lit.fill(0);
    cols.tint.fill(0);
    for (const [i, d] of b.dots.entries()) {
      const hex = shown[key(d.x, d.y)];
      if (hex === undefined) continue;
      cols.lit[i] = 1;
      cols.tint.set(oklab(hex), i * 4);
    }
  }
  light();

  /** The pointer's place on the grid, in pitches. */
  function pitchAt(e: PointerEvent): [number, number] {
    const r = canvas.getBoundingClientRect();
    const scale = r.width / frame.across;
    return [(e.clientX - r.left) / scale + frame.left, (e.clientY - r.top) / scale + frame.top];
  }

  /** Paints every dot the brush covers at `[px, py]`, or the nearest one at size 1. */
  function dab(px: number, py: number, hex: number | null, size: number): void {
    const reach = (size - 1) / 2 + 0.05;
    let near = -1;
    let nearest = Number.POSITIVE_INFINITY;
    for (const [i, [x, y]] of at.entries()) {
      const d = Math.hypot(x - px, y - py);
      if (d < nearest) [near, nearest] = [i, d];
      if (d <= reach) set(i, hex);
    }
    // Off the board's edge by more than a dot paints nothing.
    if (near >= 0 && nearest <= reach + 1) set(near, hex);
  }

  function set(i: number, hex: number | null): void {
    const d = b.dots[i];
    if (!d) return;
    const k = key(d.x, d.y);
    if (hex === null) delete shown[k];
    else shown[k] = hex;
  }

  let last: [number, number] | null = null;
  let erasing = false;
  function stroke(e: PointerEvent): void {
    const { hex, size } = brush();
    const ink = erasing ? null : hex;
    const to = pitchAt(e);
    const from = last ?? to;
    // Steps of a third of a dot, so a fast drag leaves no gaps.
    const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) * 3));
    for (let s = 1; s <= steps; s++)
      dab(
        from[0] + ((to[0] - from[0]) * s) / steps,
        from[1] + ((to[1] - from[1]) * s) / steps,
        ink,
        size,
      );
    last = to;
    light();
  }

  const down = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    erasing = e.button === 2;
    canvas.setPointerCapture(e.pointerId);
    last = null;
    stroke(e);
  };
  const move = (e: PointerEvent) => {
    if (canvas.hasPointerCapture(e.pointerId)) stroke(e);
  };
  const up = (e: PointerEvent) => {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    canvas.releasePointerCapture(e.pointerId);
    last = null;
    onPaint({ ...shown });
  };
  const menu = (e: Event) => e.preventDefault();
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', menu);

  let then = performance.now();
  let frameId = requestAnimationFrame(function tick(now) {
    sign.render(cols, 0xffffff, now - then);
    then = now;
    frameId = requestAnimationFrame(tick);
  });

  return {
    setPicture(next) {
      shown = { ...next };
      light();
    },
    destroy() {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('contextmenu', menu);
      sign.destroy();
    },
  };
}
