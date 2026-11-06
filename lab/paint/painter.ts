import { oklab } from '@msb235/blits';
import {
  board,
  createSign,
  frameOf,
  GRIDS,
  type Lamps,
  signColumns,
  triangleUnder,
} from '@/index.js';
import { floodFill } from './fill.js';
import {
  type Brush,
  covers,
  key,
  type Layout,
  type Picture,
  reachOf,
  type Stamp,
} from './model.js';
import { createOverlay } from './overlay.js';
import { stampBox, stampDots } from './stamps.js';

/** What the painter shows: the picture, the stamps floating over it, and the one picked up. */
export interface View {
  picture: Picture;
  stamps: Stamp[];
  picked: string | null;
}

export interface PainterHooks {
  brush(): Brush;
  /** A finished stroke's picture. */
  onPaint(picture: Picture): void;
  /** The stamps after one has been dragged. */
  onStamps(stamps: Stamp[]): void;
  /** The stamp the text tool picked up, or null when it clicked away from them all. */
  onPick(id: string | null): void;
}

export interface Painter {
  show(view: View): void;
  setLamps(lamps: Lamps): void;
  /** Draws the brush's outline again, after it changed. */
  redraw(): void;
  destroy(): void;
}

/**
 * A board of `layout` on `canvas`, with `overlay` laid over it for the brush and stamps' outlines.
 * Dragging paints, shades or erases with the brush, or with the text tool moves a stamp; a
 * right-drag erases.
 */
export function createPainter(
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  preview: HTMLCanvasElement,
  layout: Layout,
  view: View,
  hooks: PainterHooks,
): Painter {
  const grid = GRIDS[layout.grid];
  const triangles = layout.grid === 'triangles';
  const b = board(layout.cols, layout.rows, false);
  const sign = createSign(canvas, b, b.dots, 'dark', grid);
  const small = createSign(preview, b, b.dots, 'dark', grid);
  const marks = createOverlay(overlay, canvas, b, layout.grid);
  const cols = signColumns(b.dots.length);
  const at = b.dots.map((d) => grid(d.x, d.y));
  const indexOf = new Map(b.dots.map((d, i) => [key(d.x, d.y), i]));
  const frame = frameOf(b, grid);
  let shown: View = { ...view, picture: { ...view.picture } };
  let radius = 0.36;
  let pointer: [number, number] | null = null;

  function light(): void {
    cols.lit.fill(0);
    cols.gain.fill(1);
    cols.tint.fill(0);
    const put = (k: string, hex: number, level: number) => {
      const i = indexOf.get(k);
      if (i === undefined) return;
      cols.lit[i] = 1;
      cols.gain[i] = level;
      cols.tint.set(oklab(hex), i * 4);
    };
    for (const [k, d] of Object.entries(shown.picture)) put(k, d.hex, d.level);
    for (const s of shown.stamps)
      for (const [k, d] of Object.entries(stampDots(s, layout))) put(k, d.hex, d.level);
  }

  /** The pointer's place on the grid, in pitches. */
  function pitchAt(e: PointerEvent): [number, number] {
    const r = canvas.getBoundingClientRect();
    const scale = r.width / frame.across;
    return [(e.clientX - r.left) / scale + frame.left, (e.clientY - r.top) / scale + frame.top];
  }

  /** The index of the dot nearest `[px, py]`, and how far off it is, in pitches. */
  function nearestTo(px: number, py: number): [number, number] {
    let near = -1;
    let nearest = Number.POSITIVE_INFINITY;
    for (const [i, [x, y]] of at.entries()) {
      const d = Math.hypot(x - px, y - py);
      if (d < nearest) [near, nearest] = [i, d];
    }
    return [near, nearest];
  }

  /**
   * The index of the dot under `[px, py]`, or -1. Off the board, the nearest dot within `reach`
   * pitches; on the triangle tiling, on it, the triangle it is in, since neighbors' middles sit too
   * close for the nearest to be the right one by an edge.
   */
  function dotUnder(px: number, py: number, reach = reachOf(1) + 1): number {
    if (triangles) {
      const i = indexOf.get(key(...triangleUnder(px, py)));
      if (i !== undefined) return i;
    }
    const [near, nearest] = nearestTo(px, py);
    return nearest <= reach ? near : -1;
  }

  /** Where a brush at `[px, py]` is centered: on the triangle tiling, the middle of the triangle under it. */
  function centerOf(px: number, py: number, under: number): [number, number] {
    return triangles && under >= 0 ? (at[under] as [number, number]) : [px, py];
  }

  function redraw(): void {
    const under = pointer ? dotUnder(...pointer) : -1;
    const brush = hooks.brush();
    const d = b.dots[under];
    marks.draw({
      pointer: pointer && centerOf(...pointer, under),
      nearest: under >= 0 ? (at[under] as [number, number]) : null,
      cell: d ? [d.x, d.y] : null,
      brush,
      stamps: shown.stamps,
      picked: shown.picked,
      radius,
    });
  }

  /** Inks every dot the brush covers at `[px, py]`, and the one under it. */
  function dab(px: number, py: number, brush: Brush, erase: boolean): void {
    const under = dotUnder(px, py, reachOf(brush.size) + 1);
    const [cx, cy] = centerOf(px, py, under);
    for (const [i, [x, y]] of at.entries())
      if (covers(brush.shape, brush.size, x - cx, y - cy)) ink(i, brush, erase);
    if (under >= 0) ink(under, brush, erase);
  }

  function ink(i: number, brush: Brush, erase: boolean): void {
    const d = b.dots[i];
    if (!d) return;
    const k = key(d.x, d.y);
    const was = shown.picture[k];
    if (erase || brush.tool === 'erase') delete shown.picture[k];
    else if (brush.tool === 'shade') {
      if (was) shown.picture[k] = { ...was, level: brush.level };
    } else shown.picture[k] = { hex: brush.hex, level: brush.level };
  }

  let last: [number, number] | null = null;
  let erasing = false;
  function stroke(to: [number, number]): void {
    const brush = hooks.brush();
    const from = last ?? to;
    // Steps of a third of a dot, so a fast drag leaves no gaps.
    const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) * 3));
    for (let s = 1; s <= steps; s++)
      dab(
        from[0] + ((to[0] - from[0]) * s) / steps,
        from[1] + ((to[1] - from[1]) * s) / steps,
        brush,
        erasing,
      );
    last = to;
    light();
  }

  /** Fills the region under `p` with the brush's color, or turns it off when `erase`. */
  function fill(p: [number, number], brush: Brush, erase: boolean): void {
    const d = b.dots[dotUnder(...p)];
    if (!d) return;
    const to = erase ? null : { hex: brush.hex, level: brush.level };
    const next = floodFill(shown.picture, layout, [d.x, d.y], to);
    if (next === shown.picture) return;
    shown.picture = next;
    light();
    hooks.onPaint({ ...next });
  }

  /** The stamp being dragged, and which of its dots the pointer holds it by. */
  let held: { id: string; dx: number; dy: number } | null = null;

  function grab(p: [number, number]): void {
    const d = b.dots[dotUnder(p[0], p[1], Number.POSITIVE_INFINITY)];
    if (!d) return;
    const hit = [...shown.stamps].reverse().find((s) => {
      const box = stampBox(s, layout.grid);
      return d.x >= box.x && d.x < box.x + box.cols && d.y >= box.y && d.y < box.y + box.rows;
    });
    held = hit ? { id: hit.id, dx: d.x - hit.x, dy: d.y - hit.y } : null;
    hooks.onPick(hit?.id ?? null);
  }

  function drag(p: [number, number]): void {
    const d = b.dots[dotUnder(p[0], p[1], Number.POSITIVE_INFINITY)];
    if (!held || !d) return;
    const { id, dx, dy } = held;
    shown.stamps = shown.stamps.map((s) => (s.id === id ? { ...s, x: d.x - dx, y: d.y - dy } : s));
    light();
  }

  const down = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    const p = pitchAt(e);
    canvas.setPointerCapture(e.pointerId);
    const brush = hooks.brush();
    if (brush.tool === 'text') {
      if (e.button === 0) grab(p);
      return;
    }
    if (brush.tool === 'fill') {
      fill(p, brush, e.button === 2);
      return;
    }
    erasing = e.button === 2;
    last = null;
    stroke(p);
  };
  const move = (e: PointerEvent) => {
    pointer = pitchAt(e);
    const tool = hooks.brush().tool;
    if (canvas.hasPointerCapture(e.pointerId) && tool !== 'fill') {
      if (tool === 'text') drag(pointer);
      else stroke(pointer);
    }
    redraw();
  };
  const up = (e: PointerEvent) => {
    if (!canvas.hasPointerCapture(e.pointerId)) return;
    canvas.releasePointerCapture(e.pointerId);
    last = null;
    if (held) {
      held = null;
      hooks.onStamps(shown.stamps);
    } else if (hooks.brush().tool !== 'text' && hooks.brush().tool !== 'fill')
      hooks.onPaint({ ...shown.picture });
  };
  const leave = () => {
    pointer = null;
    redraw();
  };
  const menu = (e: Event) => e.preventDefault();
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', leave);
  canvas.addEventListener('contextmenu', menu);

  const fits = new ResizeObserver(() => {
    marks.fit();
    redraw();
  });
  fits.observe(canvas);

  let then = performance.now();
  let frameId = requestAnimationFrame(function tick(now) {
    sign.render(cols, 0xffffff, now - then);
    small.render(cols, 0xffffff, now - then);
    then = now;
    frameId = requestAnimationFrame(tick);
  });
  light();

  return {
    show(next) {
      shown = { ...next, picture: { ...next.picture } };
      light();
      redraw();
    },
    setLamps(lamps) {
      radius = (lamps.size ?? 0.72) / 2;
      sign.setLamps(lamps);
      redraw();
    },
    redraw,
    destroy() {
      cancelAnimationFrame(frameId);
      fits.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('contextmenu', menu);
      sign.destroy();
      small.destroy();
    },
  };
}
