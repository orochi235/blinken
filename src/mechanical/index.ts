import { createTicker, type Ticker } from '../ticker.js';
import { drawFlap, drawReel } from './draw.js';
import { type Glyph, type Glyphs, listOf, nameOf, pack, spellOut, stepsFrom } from './glyphs.js';
import { type CellStyle, LOOKS, type MechanicalKind } from './style.js';

export type { Box, DrawnGlyph, Glyph, Glyphs } from './glyphs.js';
export { type CellStyle, LOOKS, type MechanicalKind } from './style.js';

/** One cell's own look and glyphs, over the readout's. */
export type CellOptions = Partial<CellStyle> & { readonly glyphs?: Glyphs };

export interface MechanicalOptions {
  /** Odometer-style drums turning in a window, or split-flap cards falling. */
  readonly kind: MechanicalKind;
  readonly cells: number;
  /**
   * The glyphs every cell turns through, in order, the first padding an empty cell. Default
   * `0123456789` for a reel, and a blank, A to Z and 0 to 9 for a flap.
   */
  readonly glyphs?: Glyphs;
  /** Cells by index, each with its own glyphs or look: `{ 6: { ink: 'red' } }`, or an array. */
  readonly each?: Readonly<Record<number, CellOptions | undefined>>;
  readonly style?: Partial<CellStyle>;
  readonly value?: string | number | readonly string[];
  /** Which side a short value keeps to. Default right for a reel, left for a flap. */
  readonly align?: 'left' | 'right';
  /** How many glyphs a cell passes a second. Default 12 for a reel, 14 for a flap. */
  readonly speed?: number;
  /** How long after the cell before it each cell starts, ms. Default 50. */
  readonly stagger?: number;
  /** What a screen reader calls it; its value is read after. */
  readonly label?: string;
  readonly ticker?: Ticker;
}

export interface Mechanical {
  readonly value: string | number | readonly string[];
  /** Turns every cell forward to its glyph of `value`. */
  set(value: string | number | readonly string[]): void;
  /** Changes the look of every cell, or of cell `cell` alone. */
  setStyle(style: Partial<CellStyle>, cell?: number): void;
  destroy(): void;
}

const DEFAULT_GLYPHS: Record<MechanicalKind, string> = {
  reel: '0123456789',
  flap: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
};

/** A cell's motion: from glyph `from`, `steps` forward, starting at `at`. */
interface Cell {
  glyphs: readonly Glyph[];
  names: readonly string[];
  own: CellOptions;
  shown: number;
  from: number;
  steps: number;
  at: number;
}

const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);

/** How long a reel takes to turn `steps` glyphs at `speed` a second, ms. */
export const reelMs = (steps: number, speed: number) =>
  steps === 0 ? 0 : Math.max(300, (steps * 1000) / speed);

/** Where a reel stands `t` ms into turning `steps` from `from`, as a glyph index. */
export function reelAt(from: number, steps: number, t: number, speed: number): number {
  const ms = reelMs(steps, speed);
  if (ms === 0 || t >= ms) return from + steps;
  return from + steps * easeInOut(Math.max(0, t) / ms);
}

/** Which card a flap shows `t` ms into falling `steps` cards from `from`, and how far the next has fallen. */
export function flapAt(
  from: number,
  steps: number,
  t: number,
  speed: number,
): { card: number; phase: number } {
  const per = 1000 / speed;
  if (t <= 0 || steps === 0) return { card: from, phase: 0 };
  const k = Math.floor(t / per);
  if (k >= steps) return { card: from + steps, phase: 0 };
  return { card: from + k, phase: t / per - k };
}

/**
 * Reels or flaps on `canvas`, which fills its CSS box: give it a width and height there, since
 * its pixels follow its box.
 */
export function createMechanical(canvas: HTMLCanvasElement, opts: MechanicalOptions): Mechanical {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('blinken: no 2D context for a mechanical readout');
  const kind = opts.kind;
  const speed = opts.speed ?? (kind === 'reel' ? 12 : 14);
  const stagger = opts.stagger ?? 50;
  const align = opts.align ?? (kind === 'reel' ? 'right' : 'left');
  let shared: Partial<CellStyle> = { ...opts.style };
  const cells: Cell[] = Array.from({ length: opts.cells }, (_, k) => {
    const own = { ...opts.each?.[k] };
    const glyphs = listOf(own.glyphs ?? opts.glyphs ?? DEFAULT_GLYPHS[kind]);
    if (glyphs.length === 0) throw new Error(`blinken: cell ${k} has no glyphs to turn through`);
    return { glyphs, names: glyphs.map(nameOf), own, shown: 0, from: 0, steps: 0, at: 0 };
  });
  const styleOf = (c: Cell): CellStyle => ({ ...LOOKS[kind], ...shared, ...c.own });
  let value: string | number | readonly string[] = opts.value ?? '';
  let now = performance.now();

  /** Each cell's glyph index for `v`, a name a cell lacks keeping its current one. */
  const targets = (v: typeof value) => {
    const all = [...new Set(cells.flatMap((c) => c.names))];
    const names = pack(spellOut(v, all), cells.length, align, '');
    return cells.map((c, k) => {
      const want = names[k] ?? '';
      const i = want === '' ? 0 : c.names.indexOf(want);
      return i >= 0 ? i : c.names.findIndex((n) => n.toUpperCase() === want.toUpperCase());
    });
  };
  for (const [k, i] of targets(value).entries()) {
    const c = cells[k] as Cell;
    c.shown = c.from = Math.max(0, i);
  }

  /** Where cell `c` stands at `t`: its glyph index, a fraction for a turning reel. */
  const at = (c: Cell, t: number) =>
    kind === 'reel'
      ? reelAt(c.from, c.steps, t - c.at, speed)
      : flapAt(c.from, c.steps, t - c.at, speed).card;
  const moving = (t: number) =>
    cells.some(
      (c) =>
        c.steps > 0 &&
        t - c.at < (kind === 'reel' ? reelMs(c.steps, speed) : (c.steps * 1000) / speed),
    );

  const draw = () => {
    const scale = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const look = styleOf(cells[0] as Cell);
    ctx.fillStyle = look.housing;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pad = look.padding * scale;
    const gap = look.gap * scale;
    const w = (canvas.width - 2 * pad - gap * (cells.length - 1)) / cells.length;
    const h = canvas.height - 2 * pad;
    // Before the page lays the canvas out, there is no room to draw cells in.
    if (w <= 0 || h <= 0) return;
    for (const [k, c] of cells.entries()) {
      const box = { x: pad + k * (w + gap), y: pad, w, h };
      const style = styleOf(c);
      const n = c.glyphs.length;
      if (kind === 'reel') drawReel(ctx, c.glyphs, at(c, now), box, style, scale);
      else {
        const { card, phase } = flapAt(c.from, c.steps, now - c.at, speed);
        drawFlap(
          ctx,
          c.glyphs[card % n] as Glyph,
          // At rest a cell shows its own card whole; mid-fall, the next card shows behind.
          c.glyphs[(phase > 0 ? card + 1 : card) % n] as Glyph,
          phase,
          box,
          style,
          scale,
        );
      }
    }
  };

  const ticker = opts.ticker ?? createTicker();
  let stop: (() => void) | null = null;
  const run = () => {
    if (stop) return;
    stop = ticker.add((t) => {
      now = t;
      draw();
      if (!moving(t)) {
        for (const c of cells) {
          c.shown = c.from = (c.from + c.steps) % c.glyphs.length;
          c.steps = 0;
        }
        stop?.();
        stop = null;
      }
    });
  };

  const resize = () => {
    const scale = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    draw();
  };
  const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  watch?.observe(canvas);
  canvas.setAttribute('role', 'img');
  const label = () =>
    canvas.setAttribute(
      'aria-label',
      [opts.label, Array.isArray(value) ? value.join(' ') : String(value)]
        .filter(Boolean)
        .join(': '),
    );
  label();
  resize();

  return {
    get value() {
      return value;
    },
    set(v) {
      value = v;
      label();
      const t = performance.now();
      now = Math.max(now, t);
      for (const [k, i] of targets(v).entries()) {
        const c = cells[k] as Cell;
        if (i < 0) continue;
        const here = Math.round(at(c, t)) % c.glyphs.length;
        c.from = here;
        c.steps = stepsFrom(here, i, c.glyphs.length);
        c.at = t + k * stagger;
      }
      run();
    },
    setStyle(style, cell) {
      if (cell === undefined) shared = { ...shared, ...style };
      else {
        const c = cells[cell];
        if (c) c.own = { ...c.own, ...style };
      }
      draw();
    },
    destroy() {
      stop?.();
      watch?.disconnect();
    },
  };
}
