import { type Handle, type Mix, mix } from '@msb235/blits';
import { type Board, board, KIT, type Led, type Pose, SIZE, type Subject } from './board.js';
import { type Border, cueBorder } from './border.js';
import type { Defect } from './defects.js';
import { createSign, paintBulbs, type SignColumns, signColumns } from './draw.js';
import type { EffectSpec } from './effects.js';
import { faceOf } from './font.js';
import { cueLayers, type LayerOption } from './layers.js';
import type { Fade, Ghost } from './optics.js';
import type { ParamValue } from './params.js';
import { layOut, type Pass, PassClock, type PassScene } from './pass.js';
import { PLANES, type Plane } from './planes.js';
import { cueProgram, effectOf, type Scene, type StagedScene, stageProgram } from './program.js';
import { createTicker, type Ticker } from './ticker.js';

/** A gap between frames this long is a hidden tab coming back, and is left out of the show. */
const AWAY_MS = 250;

/** What one frame cost, smoothed over about twenty frames. */
export interface FrameCost {
  /** `sync` plus one `pull` of every light, ms. */
  readonly mixMs: number;
  /** The canvas work, ms; 0 with `draw: false`. */
  readonly drawMs: number;
}

export interface MarqueeOptions {
  /** Dots across and down. Default 80 × 7, one line of text. */
  readonly cols?: number;
  readonly rows?: number;
  /**
   * The messages it plays, in a loop. A function is read again at the start of every pass, so a
   * program can follow inputs that change. Default: nothing, until `setProgram`.
   */
  readonly program?: readonly Scene[] | (() => readonly Scene[]);
  /** Effects scenes can name, ahead of the built-ins. */
  readonly effects?: Readonly<Record<string, EffectSpec>>;
  /**
   * Layers by name: a built-in's name with on, off or a weight, or a full spec under any name.
   * Default: none.
   */
  readonly layers?: Partial<Record<string, LayerOption>>;
  /**
   * The border of bulbs round the dots and how they light, or false for none, which also takes
   * away the margin they stand in. Fixed once made, but `setBorder` changes how they light.
   * Default unlit bulbs.
   */
  readonly border?: false | Border;
  /**
   * Another sign whose planes this one takes over, each dot from the dot at the same place on it:
   * `color` makes a preview wear what the main sign is wearing while keeping its own shape.
   * `source` is read every frame, so it can follow a sign that is replaced. Default none.
   */
  readonly follow?: Follow;
  /** False leaves the housing round the dots see-through rather than dark. Default true. */
  readonly housing?: boolean;
  /** The color of a lit dot nothing has tinted. Default amber. */
  readonly color?: number;
  /** The mix's rate. Default 1. */
  readonly rate?: number;
  /** Broken lights, which show their fault whatever the program asks; `scatter` makes some. Default none. */
  readonly defects?: readonly Defect[];
  /** How fast its lights light and go dark, ms. Default 12 up, 110 down, like a filament. */
  readonly fade?: Fade;
  /** How much an unlit dot shows of its lit row and column, as a multiplexed sign does. Default none. */
  readonly ghost?: Ghost;
  /** False runs the mix without drawing, for timing it alone. Default true. */
  readonly draw?: boolean;
  /**
   * The clock its frames run on; signs sharing one draw from one animation frame callback, and a
   * throttled one draws them less often. Default a ticker of its own, every display frame.
   */
  readonly ticker?: Ticker;
  /** Called after every frame with what it cost. */
  readonly onFrame?: (cost: FrameCost) => void;
  /**
   * What debuggers call its mix. Default `marquee #<canvas id> <cols>×<rows>`, or without an id
   * `marquee <cols>×<rows>`.
   */
  readonly name?: string;
}

/** Which sign a marquee follows, and in which planes. */
export interface Follow {
  readonly source: () => Marquee | null;
  readonly planes: readonly Plane[];
}

export interface Marquee {
  readonly board: Board;
  /** Its dots and border bulbs as the last frame drew them, every channel. */
  readonly columns: SignColumns;
  /**
   * Draws the last frame again without running the mix, taking what it follows afresh: for a
   * still that follows a moving sign.
   */
  repaint(): void;
  /**
   * Marks dots to draw swapped, lit for dark and dark for lit, over whatever the mix gives them:
   * a text selection or a caret on a sign that is being typed into. Null marks none.
   */
  setHighlight(marked: ((dot: Led) => boolean) | null): void;
  /** The mix lighting it, for cueing voices of your own on its dots and border cells. */
  readonly mix: Mix<Subject, Pose>;
  /** Replaces the program from the next pass; throws on a scene naming no effect or face. */
  setProgram(program: readonly Scene[] | (() => readonly Scene[])): void;
  /** Replaces the effects scenes can name, from the next pass; throws if a scene names none of them. */
  setEffects(effects: Readonly<Record<string, EffectSpec>>): void;
  /** Starts the program over at `fromScene`, fading the pass playing now at once. */
  restart(fromScene?: number): void;
  /** Where the pass playing now stands, on the mix clock, so rate changes count; null while none plays. */
  pass(): Pass | null;
  /**
   * Moves the pass playing now to `ms` from its start, clamped to its length. With `hold`, it stays
   * at that moment until a seek without it, or the next restart.
   */
  seek(ms: number, opts?: { hold?: boolean }): void;
  /** Turns a layer on or off, or sets the weight it plays at; `params` re-cue it with them. */
  setLayer(name: string, on: boolean | number, params?: Readonly<Record<string, ParamValue>>): void;
  /** The color of a lit dot nothing has tinted. */
  setColor(hex: number): void;
  /** Ramps the mix's rate to `rate` over `ms`. */
  ramp(rate: number, ms?: number): void;
  /** Replaces the broken lights. */
  setDefects(defects: readonly Defect[]): void;
  /** Sets how fast its lights light and go dark. */
  setFade(fade: Fade): void;
  /** Sets how much an unlit dot shows of its lit row and column. */
  setGhost(ghost: Ghost): void;
  /** Sets how the border's bulbs light; a sign made with no border has none to light. */
  setBorder(border: Border): void;
  /** Stops the frame loop, lets go of the canvas, and takes its mix off the debuggers' list. */
  destroy(): void;
}

const AMBER = 0xff9a2e;

/**
 * A sign on `canvas`, playing its program in a loop under whichever layers are on. It sizes the
 * canvas to the largest that fits its parent element, and draws every animation frame.
 */
export function createMarquee(canvas: HTMLCanvasElement, opts: MarqueeOptions = {}): Marquee {
  const b = board(opts.cols ?? SIZE.cols, opts.rows ?? SIZE.rows, opts.border !== false);
  const m = mix<Subject, Pose>(KIT, {
    name: opts.name ?? `marquee ${canvas.id ? `#${canvas.id} ` : ''}${b.cols}×${b.rows}`,
    labelOf: (s: Subject) => (s.kind === 'cell' ? `cell ${s.i}` : `dot ${s.x},${s.y}`),
  });
  if (opts.rate !== undefined && opts.rate !== 1) m.ramp(opts.rate, 0);

  const leds: readonly Led[] = [...b.dots, ...b.bulbs];
  const cols = signColumns(leds.length);
  const cells = signColumns(b.cells.length);
  const drawing = opts.draw ?? true;
  const sign = drawing ? createSign(canvas, b, leds, opts.housing ?? true) : null;
  if (opts.defects) sign?.setDefects(opts.defects);
  if (opts.fade) sign?.setFade(opts.fade);
  if (opts.ghost) sign?.setGhost(opts.ghost);
  let color = opts.color ?? AMBER;

  let program = opts.program ?? [];
  let effects = opts.effects ?? {};
  let live = true;
  let pass: Handle<Subject> | null = null;
  let scenes: readonly PassScene[] = [];
  let length = 0;
  const clock = new PassClock();
  /** A pass ended; the next starts at the next frame, so one that ends at once cannot spin. */
  let due = false;
  let staged: readonly StagedScene[] = [];
  /** Cues the staged pass afresh, from its start. */
  const cue = () => {
    const mine = cueProgram(m, staged);
    clock.set(m.now);
    pass = mine;
    mine.done.then(() => {
      if (pass === mine) due = true;
    });
    return mine;
  };
  // Each pass reads the program and effects as they stand when it starts.
  const again = (from = 0) => {
    if (!live) return;
    const all = typeof program === 'function' ? program() : program;
    const offset = from > 0 && from < all.length ? from : 0;
    const chosen = offset ? all.slice(offset) : all;
    staged = stageProgram(b, chosen, effects);
    ({ scenes, length } = layOut(staged, offset));
    if (chosen.length > 0) cue();
    else pass = null;
  };
  again();

  let synced = false;
  let early: { at: number; rate: number } | null = null;
  /** Moves the pass to `at`, playing at `rate`. */
  const moveTo = (at: number, rate: number) => {
    if (pass === null) return;
    // A scene that has ended has left the mix, so the pass is cued again and moved from its start.
    pass.fade({ over: 0 });
    const fresh = cue();
    fresh.seek(at);
    fresh.rate = rate;
    clock.set(m.now, at, rate);
  };

  /**
   * Throws on a scene naming no effect or face; a program given as a function is checked as each
   * pass starts.
   */
  const check = (p: typeof program, e: typeof effects) => {
    if (typeof p !== 'function')
      for (const scene of p) {
        effectOf(scene, e);
        faceOf(scene.face);
      }
  };

  const layers = cueLayers(m, b, opts.layers);
  const border = cueBorder(m, b, opts.border || { bulbs: 'unlit' });

  let last = performance.now();
  let mixMs = 0;
  let drawMs = 0;
  const frame = (now: number) => {
    let gap = now - last;
    last = now;
    if (gap > AWAY_MS) {
      m.rebase();
      gap = 0;
    }
    if (due) {
      due = false;
      // A pass that cannot start leaves the sign idle, its layers playing, until setProgram or
      // setEffects.
      try {
        again();
      } catch (e) {
        pass = null;
        console.error(e);
      }
    }
    const t0 = performance.now();
    m.sync(now);
    synced = true;
    if (early) {
      moveTo(early.at, early.rate);
      early = null;
    }
    clock.settle(m.now);
    m.pull(b.dots, cols);
    m.pull(b.cells, cells);
    paintBulbs(b, cells, cols);
    follow();
    highlight();
    const t1 = performance.now();
    sign?.render(cols, color, gap);
    const t2 = performance.now();
    mixMs += (t1 - t0 - mixMs) * 0.05;
    drawMs += (t2 - t1 - drawMs) * 0.05;
    opts.onFrame?.({ mixMs, drawMs });
  };
  const followed = opts.follow ? opts.follow.planes.flatMap((plane) => PLANES[plane]) : [];
  /** Lays the followed sign's planes over this one's dots, each from the dot at the same place. */
  function follow(): void {
    const source = opts.follow?.source();
    if (!source || source === self) return;
    const from = source.columns;
    const sb = source.board;
    for (let i = 0; i < b.dots.length; i++) {
      const d = b.dots[i] as Led;
      const sx = Math.min(sb.cols - 1, Math.floor(((d.x + 0.5) * sb.cols) / b.cols));
      const sy = Math.min(sb.rows - 1, Math.floor(((d.y + 0.5) * sb.rows) / b.rows));
      const j = sy * sb.cols + sx;
      for (const c of followed) {
        if (c === 'tint')
          for (let k = 0; k < 4; k++) cols.tint[i * 4 + k] = from.tint[j * 4 + k] ?? 0;
        else cols[c][i] = from[c][j] ?? 0;
      }
    }
  }

  let marked: ((dot: Led) => boolean) | null = null;
  /** The invert each marked dot had from the mix, so marking it again doesn't swap it back. */
  let mixed: Float64Array | null = null;
  function highlight(): void {
    if (!marked) return;
    mixed = Float64Array.from(cols.invert.subarray(0, b.dots.length));
    for (let i = 0; i < b.dots.length; i++)
      if (marked(b.dots[i] as Led)) cols.invert[i] = 1 - Math.min(1, Math.max(0, mixed[i] ?? 0));
  }

  const self: Marquee = {
    board: b,
    columns: cols,
    repaint() {
      follow();
      sign?.render(cols, color, 0);
    },
    setHighlight(next) {
      // A held sign won't pull again, so the mix's own invert comes back from what was kept.
      if (mixed) cols.invert.set(mixed);
      mixed = null;
      marked = next;
      highlight();
      sign?.render(cols, color, 0);
    },
    mix: m,
    setProgram(next) {
      check(next, effects);
      const idle = pass === null;
      program = next;
      if (idle) again();
    },
    setEffects(next) {
      check(program, next);
      effects = next;
      if (pass === null) again();
    },
    restart(fromScene = 0) {
      early = null;
      pass?.fade({ over: 0 });
      due = false;
      again(fromScene);
    },
    pass() {
      if (pass === null || length === 0) return null;
      return { at: Math.min(length, Math.max(0, clock.read(m.now))), length, scenes };
    },
    seek(ms, opts = {}) {
      if (pass === null) return;
      const at = Math.min(length, Math.max(0, ms));
      const rate = opts.hold ? 0 : 1;
      // The mix has no time to seek from until its first sync, so the first frame makes the seek.
      if (!synced) {
        early = { at, rate };
        clock.set(Number.NaN, at, rate);
        return;
      }
      moveTo(at, rate);
    },
    setLayer(name, on, params) {
      layers.set(name, on, params);
    },
    setColor(hex) {
      color = hex;
    },
    ramp(rate, ms = 200) {
      m.ramp(rate, ms);
    },
    setDefects(defects) {
      sign?.setDefects(defects);
    },
    setFade(fade) {
      sign?.setFade(fade);
    },
    setGhost(ghost) {
      sign?.setGhost(ghost);
    },
    setBorder(next) {
      border.set(next);
    },
    destroy() {
      live = false;
      stop();
      sign?.destroy();
      m.close();
    },
  };
  const stop = (opts.ticker ?? createTicker()).add(frame);
  return self;
}
