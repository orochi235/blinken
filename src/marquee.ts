import { type Handle, level, type Mix, mix } from '@msb235/blits';
import { type Board, board, KIT, type Led, type Pose, SIZE, type Subject } from './board.js';
import { LAYERS, type LayerSpec } from './builtins.js';
import { createSign, type SignColumns, signColumns } from './draw.js';
import type { EffectSpec } from './effects.js';
import type { ParamValue } from './params.js';
import { cueLayer, play, type Step } from './program.js';

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
  readonly program?: readonly Step[] | (() => readonly Step[]);
  /** Effects steps can name, ahead of the built-ins. */
  readonly effects?: Readonly<Record<string, EffectSpec>>;
  /**
   * Layers by name: a built-in's name with on, off or a weight, or a full spec under any name.
   * Default: none.
   */
  readonly layers?: Partial<Record<string, boolean | number | LayerSpec>>;
  /** The color of a lit dot nothing has tinted. Default amber. */
  readonly color?: number;
  /** The mix's rate. Default 1. */
  readonly rate?: number;
  /** False runs the mix without drawing, for timing it alone. Default true. */
  readonly draw?: boolean;
  /** Called after every frame with what it cost. */
  readonly onFrame?: (cost: FrameCost) => void;
}

export interface Marquee {
  readonly board: Board;
  /** The mix lighting it, for cueing voices of your own on its dots and border cells. */
  readonly mix: Mix<Subject, Pose>;
  /** Replaces the program from the next pass. */
  setProgram(program: readonly Step[] | (() => readonly Step[])): void;
  /** Replaces the effects steps can name, from the next pass. */
  setEffects(effects: Readonly<Record<string, EffectSpec>>): void;
  /** Starts the program over at `fromStep`, fading the pass playing now at once. */
  restart(fromStep?: number): void;
  /** Turns a layer on or off, or sets the weight it plays at; `params` re-cue it with them. */
  setLayer(name: string, on: boolean | number, params?: Readonly<Record<string, ParamValue>>): void;
  /** The color of a lit dot nothing has tinted. */
  setColor(hex: number): void;
  /** Ramps the mix's rate to `rate` over `ms`. */
  ramp(rate: number, ms?: number): void;
  /** Stops the frame loop and lets go of the canvas. */
  destroy(): void;
}

const AMBER = 0xff9a2e;

/**
 * A sign on `canvas`, playing its program in a loop under whichever layers are on. It sizes the
 * canvas to the largest that fits its parent element, and draws every animation frame.
 */
export function createMarquee(canvas: HTMLCanvasElement, opts: MarqueeOptions = {}): Marquee {
  const b = board(opts.cols ?? SIZE.cols, opts.rows ?? SIZE.rows);
  const m = mix<Subject, Pose>(KIT, { name: 'marquee' });
  if (opts.rate !== undefined && opts.rate !== 1) m.ramp(opts.rate, 0);

  const leds: readonly Led[] = [...b.dots, ...b.bulbs];
  const cols = signColumns(leds.length);
  const cells = signColumns(b.cells.length);
  const bulbsAt = b.dots.length;
  const CHANNELS = Object.keys(cols) as (keyof SignColumns)[];
  /** Paints each bulb with its cell's pose, after the dots in the columns the sign reads. */
  const paintBulbs = () => {
    for (let j = 0; j < b.bulbs.length; j++) {
      const c = b.cellOf[j] as number;
      for (const ch of CHANNELS) {
        const n = ch === 'tint' ? 4 : 1;
        cols[ch].set(cells[ch].subarray(c * n, c * n + n), (bulbsAt + j) * n);
      }
    }
  };
  const drawing = opts.draw ?? true;
  const sign = drawing ? createSign(canvas, b, leds) : null;
  let color = opts.color ?? AMBER;

  let program = opts.program ?? [];
  let effects = opts.effects ?? {};
  let live = true;
  let pass: Handle<Subject> | null = null;
  /** A pass ended; the next starts at the next frame, so one that ends at once cannot spin. */
  let due = false;
  // Each pass reads the program and effects as they stand when it starts.
  const again = (from = 0) => {
    if (!live) return;
    const all = typeof program === 'function' ? program() : program;
    const steps = from > 0 ? all.slice(from) : all;
    const mine = steps.length > 0 ? play(m, b, steps, effects) : null;
    pass = mine;
    mine?.done.then(() => {
      if (pass === mine) due = true;
    });
  };
  again();

  type Weight = ReturnType<typeof level<Subject>>;
  const weightOf = (spec: LayerSpec, on: boolean | number) =>
    on === true ? (spec.weight ?? 1) : on === false ? 0 : on;
  const layers = new Map<string, { spec: LayerSpec; weight: Weight; voice: Handle<Subject> }>();
  const addLayer = (name: string, spec: LayerSpec, on: boolean | number) => {
    const weight = level<Subject>(weightOf(spec, on));
    layers.set(name, { spec, weight, voice: cueLayer(m, b, spec, weight) });
  };
  for (const [name, spec] of Object.entries(LAYERS)) addLayer(name, spec, false);
  for (const [name, v] of Object.entries(opts.layers ?? {})) {
    if (v === undefined) continue;
    if (typeof v === 'object') {
      layers.get(name)?.voice.fade({ over: 0 });
      addLayer(name, v, true);
    } else
      layers.get(name)?.weight.set(weightOf((layers.get(name) as { spec: LayerSpec }).spec, v));
  }

  let last = performance.now();
  let mixMs = 0;
  let drawMs = 0;
  let raf = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    let gap = now - last;
    last = now;
    if (gap > AWAY_MS) {
      m.rebase();
      gap = 0;
    }
    if (due) {
      due = false;
      again();
    }
    const t0 = performance.now();
    m.sync(now);
    m.pull(b.dots, cols);
    m.pull(b.cells, cells);
    paintBulbs();
    const t1 = performance.now();
    sign?.render(cols, color, gap);
    const t2 = performance.now();
    mixMs += (t1 - t0 - mixMs) * 0.05;
    drawMs += (t2 - t1 - drawMs) * 0.05;
    opts.onFrame?.({ mixMs, drawMs });
  };
  raf = requestAnimationFrame(frame);

  return {
    board: b,
    mix: m,
    setProgram(next) {
      const idle = pass === null;
      program = next;
      if (idle) again();
    },
    setEffects(next) {
      effects = next;
    },
    restart(fromStep = 0) {
      pass?.fade({ over: 0 });
      due = false;
      again(fromStep);
    },
    setLayer(name, on, params) {
      const layer = layers.get(name);
      if (!layer) throw new Error(`bree: no layer named ${name}`);
      if (params) {
        const spec = { ...layer.spec, params: { ...layer.spec.params, ...params } };
        layer.voice.fade({ over: 0 });
        layer.voice = cueLayer(m, b, spec, layer.weight);
        layer.spec = spec;
      }
      layer.weight.set(weightOf(layer.spec, on));
    },
    setColor(hex) {
      color = hex;
    },
    ramp(rate, ms = 200) {
      m.ramp(rate, ms);
    },
    destroy() {
      live = false;
      cancelAnimationFrame(raf);
      sign?.destroy();
    },
  };
}
