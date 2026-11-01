import { type Handle, mix } from '@msb235/blits';
import { board, KIT, type Led, type Pose, SIZE, type Subject } from './board.js';
import { cueBorder } from './border.js';
import { AMBER } from './color.js';
import { createSign, paintBulbs, signColumns } from './draw.js';
import type { Stop } from './effects.js';
import { faceOf } from './font.js';
import { gridOf } from './grid.js';
import { cueLayers } from './layers.js';
import type { Marquee, MarqueeOptions } from './marquee-api.js';
import { layOut, PassClock, type PassScene } from './pass.js';
import { PLANES } from './planes.js';
import { cueProgram, effectOf, type StagedScene, stageProgram } from './program.js';
import { createTicker } from './ticker.js';

/** A gap between frames this long is a hidden tab coming back, and is left out of the show. */
const AWAY_MS = 250;

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
  const sign = drawing
    ? createSign(canvas, b, leds, opts.housing ?? true, gridOf(opts.grid))
    : null;
  if (opts.defects) sign?.setDefects(opts.defects);
  if (opts.fade) sign?.setFade(opts.fade);
  if (opts.ghost) sign?.setGhost(opts.ghost);
  if (opts.lamps) sign?.setLamps(opts.lamps);
  let color = opts.color ?? AMBER;

  let program = opts.program ?? [];
  let effects = opts.effects ?? {};
  let live = true;
  let pass: Handle<Subject> | null = null;
  let scenes: readonly PassScene[] = [];
  let length = 0;
  let stops: readonly Stop[] = [];
  /** The stop the pass is waiting at, or null while it is not waiting. */
  let held: number | null = null;
  /** Where the pass stood at the last frame, so a rest it ran past since holds it. */
  let passed = Number.NEGATIVE_INFINITY;
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
    ({ scenes, length, stops } = layOut(staged, offset));
    held = null;
    passed = Number.NEGATIVE_INFINITY;
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
    held = null;
    passed = at;
  };
  /** Holds the pass at the first rest it has reached since the last frame. */
  const rest = () => {
    if (pass === null || held !== null) return;
    const now = clock.read(m.now);
    const i = stops.findIndex((s) => !s.release && s.at > passed && s.at <= now);
    if (i < 0) {
      passed = now;
      return;
    }
    moveTo((stops[i] as Stop).at, 0);
    held = i;
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
    rest();
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
      return {
        at: Math.min(length, Math.max(0, clock.read(m.now))),
        length,
        scenes,
        waiting: held !== null,
      };
    },
    seek(ms, opts = {}) {
      if (pass === null) return;
      const at = Math.min(length, Math.max(0, ms));
      const rate = opts.hold ? 0 : 1;
      // The mix has no time to seek from until its first sync, so the first frame makes the seek.
      if (!synced) {
        early = { at, rate };
        clock.set(Number.NaN, at, rate);
        held = null;
        passed = at;
        return;
      }
      moveTo(at, rate);
    },
    step() {
      if (held === null) return;
      const k = held + 1;
      const next = stops[k];
      if (next === undefined) {
        moveTo((stops[held] as Stop).at, 1);
        return;
      }
      moveTo(next.at, next.release ? 1 : 0);
      if (!next.release) held = k;
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
    setLamps(lamps) {
      sign?.setLamps(lamps);
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
