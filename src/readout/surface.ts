import { type Handle, type Mix, mix, oklab } from '@msb235/blits';
import { KIT, type Pose, type Subject } from '../board.js';
import { AMBER } from '../color.js';
import type { Defect } from '../defects.js';
import { signColumns } from '../draw.js';
import { GRIDS } from '../grid.js';
import { FADE } from '../optics.js';
import { attach, pullChannels } from '../render/attach.js';
import { swapMarked } from '../render/highlight.js';
import type { SignLights } from '../render/sign-lights.js';
import { awayGaps, createTicker } from '../ticker.js';
import type { Readout, ReadoutDefect, ReadoutOptions, Surface, SurfaceOptions } from './api.js';
import { flow } from './flow.js';
import { dotOf, type Laid, type Layout, layOutReadouts, linesOf } from './layout.js';
import { type Box, type Canvas, type Placed, surfacePlacement } from './placement.js';
import { createTextLayer, type Picked } from './text.js';
import type { SegLight, Selection } from './type.js';
import { TYPES } from './types/index.js';
import { half as HALF } from './types/segments.js';
import { valueVoice } from './voice.js';

const NIXIE = 0xff6a1a;

interface Entry extends Placed {
  readonly opts: ReadoutOptions;
  value: string | number;
  color: number;
  defects: readonly ReadoutDefect[];
  /** Which of its cells the page's selection takes in. */
  picked: readonly boolean[];
  /** The cell an editable one's caret stands at, while it has the focus. */
  caret: number | null;
  /** How its selected cells show, where `setSelection` changed it. */
  selection: Selection | undefined;
}

/** How a readout's selected cells show. */
const selectionOf = (e: Entry): Selection =>
  e.selection ?? e.opts.selection ?? TYPES[e.opts.type].selection ?? 'glow';

/** A selected light's color: `lab` paler and a little less saturated. */
const paler = ([l = 0, a = 0, b = 0, alpha = 1]: readonly number[]): number[] => [
  l + (1 - l) * 0.6,
  a * 0.5,
  b * 0.5,
  alpha,
];
/** How brightly a selected cell's unlit lights glow, where they do. */
const GLOW_UNLIT = 0.18;

const insides = new WeakMap<Surface, { mix: Mix<Subject, Pose>; layout: () => Layout }>();

/** A surface's mix and layout, for tests that cue effects on its readouts. Not for consumers. */
export const insideOf = (s: Surface) => insides.get(s);

/** Splits a value for a readout led by a ½ digit: the ½ digit's part, and the rest. */
function splitHalf(value: string | number, cells: number): [string, string | number] {
  const str = String(value);
  const minus = str.startsWith('-');
  const body = minus ? str.slice(1) : str;
  const one = body.replace(/[.:,]/g, '').length > cells && body.startsWith('1');
  return [`${minus ? '-' : ''}${one ? '1' : ''}`, one ? body.slice(1) : body];
}

/** Whether a readout can be typed into: asked to be, of a type that spells, with no ½ digit. */
const editable = (e: Entry) =>
  (e.opts.edit ?? false) && !e.opts.half && TYPES[e.opts.type].spell !== undefined;

/** How long a caret shows, then hides, ms. */
const BLINK_MS = 530;

/** Whether a readout's characters can be selected: its type spells, and it wasn't asked not to. */
const selectable = (e: Entry) => (e.opts.select ?? true) && TYPES[e.opts.type].spell !== undefined;

/** What the layout needs of a readout. */
const laidOf = (e: Entry): Laid => ({
  type: TYPES[e.opts.type],
  cells: e.opts.cells,
  face: e.opts.face ?? 'plate',
  ends: e.opts.ends,
  half: e.opts.half,
  underline: selectable(e) && (selectionOf(e) === 'underline' || editable(e)),
  lines: e.opts.lines,
});

/** A readout as its value lays it out, cell by cell in `Spot.cells` order. */
interface Shown {
  /** Each cell's lights, which of them are lit, and the characters it shows. */
  readonly cells: readonly {
    readonly lights: readonly SegLight[];
    readonly lit: ReadonlySet<string>;
    readonly text: string;
  }[];
  /** For one that spells, each character of its value's cell, or -1 where it shows nowhere. */
  readonly places: readonly number[];
  /** For each caret place in its value, the cell a caret there stands at. */
  readonly carets: readonly (number | null)[];
  /** Its value as it copies, a character for each of the value's. */
  readonly copied: string;
  /** How many of its value's characters were cut off for want of room. */
  readonly cut: number;
}

/** How `e`'s value lays out on its cells, a ½ digit's first, row by row. */
function shownOf(e: Entry): Shown {
  const type = TYPES[e.opts.type];
  const align = e.opts.align ?? type.align;
  const { perLine, first } = e.spot;
  const lines = linesOf(laidOf(e));
  const none = new Set<string>();
  const cells = Array.from({ length: lines * perLine }, (_, k) => ({
    lights: k % perLine < first ? HALF.cell.lights : type.cell.lights,
    lit: none as ReadonlySet<string>,
    text: '',
  }));
  const [lead, rest] = e.opts.half ? splitHalf(e.value, e.opts.cells) : ['', e.value];
  if (e.opts.half && cells[0]) {
    const tok = HALF.spell?.tokens(lead)[0] ?? '';
    cells[0] = { ...cells[0], lit: HALF.spell?.lights(tok) ?? none, text: tok };
  }
  const spell = type.spell;
  if (!spell) {
    for (const [c, lit] of type.encode(rest, e.opts.cells, align).entries()) {
      const k = first + c;
      if (cells[k]) cells[k] = { ...cells[k], lit };
    }
    return { cells, places: [], carets: [], cut: 0, copied: String(e.value) };
  }
  // As shown, each character the one its glyph draws, where that keeps it one character.
  const asShown = (tok: string) =>
    e.opts.copy === 'value'
      ? tok
      : [...tok]
          .map((ch) => {
            const to = spell.shown?.(ch) ?? ch;
            return [...to].length === 1 ? to : ch;
          })
          .join('');
  const toks = spell.tokens(rest);
  const f = flow(toks, e.opts.cells, lines, align, e.opts.wrap ?? true);
  /** A flowed cell, row by row `cells` wide, as a cell of the spot, past any ½ digit. */
  const cellOf = (at: number) =>
    at < 0 ? -1 : Math.floor(at / e.opts.cells) * perLine + first + (at % e.opts.cells);
  const places: number[] = [];
  const carets: (number | null)[] = [];
  for (const [t, tok] of toks.entries()) {
    const k = cellOf(f.at[t] ?? -1);
    if (k >= 0 && cells[k]) cells[k] = { ...cells[k], lit: spell.lights(tok), text: asShown(tok) };
    const before = f.carets[t];
    for (let c = 0; c < [...tok].length; c++) {
      places.push(k);
      carets.push(
        c === 0 || k < 0 ? (before === null || before === undefined ? null : cellOf(before)) : k,
      );
    }
  }
  const end = f.carets[toks.length];
  carets.push(end === null || end === undefined ? null : cellOf(end));
  return { cells, places, carets, cut: f.cut, copied: asShown(String(e.value)) };
}

/**
 * A surface on `canvas`, its readouts placed by `boxOf` and the canvas sized by `sizing`: the core
 * of `createPanel` and `createOverlay`.
 */
export function createSurface(
  canvas: HTMLCanvasElement,
  opts: SurfaceOptions,
  sizing: Canvas,
  boxOf: (o: ReadoutOptions, canvas: HTMLCanvasElement) => () => Box | null,
): Surface {
  const entries: Entry[] = [];
  const placement = surfacePlacement(() => entries, sizing);
  let layout: Layout = layOutReadouts([]);
  const lightsOf = (l: Layout): SignLights => ({
    board: l.board,
    leds: l.leds,
    prims: l.prims,
    place: () => placement,
  });
  const drawing = attach(canvas, layout.board, layout.leds, {
    draw: opts.draw ?? true,
    backend: opts.backend,
    gpu: opts.gpu,
    housing: 'clear',
    grid: GRIDS.square,
    lights: lightsOf(layout),
  });
  const { sign } = drawing;
  const m = mix<Subject, Pose>(KIT, { name: 'readouts', engine: drawing.engine });
  drawing.bind(m);
  if (opts.fade) sign?.setFade(opts.fade);
  if (opts.ghost) sign?.setGhost(opts.ghost);
  if (opts.lamps) sign?.setLamps(opts.lamps);
  let cols = signColumns(layout.leds.length);
  let cells = signColumns(layout.board.cells.length);
  let voice: Handle<Subject> | null = null;
  let shaped = true;
  let valued = true;
  /** The lights of the cells the page's selection takes in, or null with none. */
  let marked: Uint8Array | null = null;
  /** Whether a caret shows this half of its blink. */
  let blinkOn = true;
  const mark = (picked: readonly (Picked | null)[]) => {
    const b = layout.board;
    const lightsAt = (e: Entry, k: number) =>
      k % e.spot.perLine < e.spot.first
        ? HALF.cell.lights.length
        : TYPES[e.opts.type].cell.lights.length;
    const mask = new Uint8Array(b.dots.length);
    let any = false;
    for (const [i, e] of entries.entries()) {
      const cells = picked[i]?.cells ?? [];
      const caret = picked[i]?.caret ?? null;
      const was = e.picked;
      e.picked = cells;
      if (caret !== e.caret) {
        e.caret = caret;
        blinkOn = true;
        caretAt = performance.now();
        valued = true;
      }
      if (selectionOf(e) !== 'invert') {
        if (cells.some((on, k) => on !== (was[k] ?? false))) valued = true;
        continue;
      }
      for (const [k, on] of cells.entries()) {
        if (!on) continue;
        any = true;
        for (let s = 0; s < lightsAt(e, k); s++) mask[dotOf(e.spot, b.cols, k, s)] = 1;
      }
    }
    const next = any ? mask : null;
    const same = next === marked || (next && marked && next.every((v, i) => v === marked?.[i]));
    marked = next;
    drawing.webgpu?.setHighlight(marked);
    // An idle surface draws again for a new highlight.
    if (!same) valued = true;
  };
  const text =
    sign && typeof document !== 'undefined'
      ? createTextLayer(canvas, sizing.fixed ?? false, mark, (i, value) => {
          const e = entries[i];
          if (!e) return false;
          const was = e.value;
          const before = shownOf(e).cut;
          e.value = value;
          // An edit cutting off more than was is refused, but a one-line number keeps its last cells.
          const align = e.opts.align ?? TYPES[e.opts.type].align;
          if (shownOf(e).cut > before && (linesOf(laidOf(e)) > 1 || align === 'left')) {
            e.value = was;
            return false;
          }
          valued = true;
          e.opts.onInput?.(value);
          return true;
        })
      : null;
  /** When the caret last moved, so it shows at once and blinks from there. */
  let caretAt = 0;

  const reshape = () => {
    layout = layOutReadouts(entries.map(laidOf));
    for (const [i, e] of entries.entries()) e.spot = layout.spots[i] as Layout['spots'][number];
    drawing.reshape(lightsOf(layout));
    cols = signColumns(layout.leds.length);
    cells = signColumns(layout.board.cells.length);
    const defects: Defect[] = entries.flatMap((e) =>
      e.defects.map((d) => ({
        ...d,
        at: { x: e.spot.first + d.at.cell, y: e.spot.base + d.at.slot },
      })),
    );
    sign?.setDefects(defects);
    placement.refit();
    text?.build(
      entries.map((e) =>
        selectable(e)
          ? {
              spot: e.spot,
              block: selectionOf(e) === 'block',
              edit: editable(e),
              label: e.opts.label,
            }
          : null,
      ),
    );
  };

  /** Cues the readouts' values afresh, the last cue faded out at once. */
  const play = () => {
    const b = layout.board;
    const on = new Float32Array(b.cols * b.rows);
    const tint = new Float32Array(b.cols * b.rows * 4);
    for (const [i, e] of entries.entries()) {
      const shown = shownOf(e);
      const color = oklab(e.color);
      const pale = paler(color);
      const how = selectionOf(e);
      // Stacked lights, as a Nixie's cathodes are, tangle when the unlit ones glow too.
      const dimUnlit = how === 'glow' && TYPES[e.opts.type].socket === 'segment';
      for (const [k, { lights, lit }] of shown.cells.entries()) {
        const picked = e.picked[k] ?? false;
        const caret = e.caret === k && blinkOn;
        if ((caret || (picked && how === 'underline')) && e.spot.underline !== null) {
          const at = dotOf(e.spot, b.cols, k, e.spot.underline);
          on[at] = 1;
          tint.set(color, at * 4);
        }
        for (const [slot, light] of lights.entries()) {
          const at = dotOf(e.spot, b.cols, k, slot);
          on[at] = lit.has(light.name) ? 1 : picked && dimUnlit ? GLOW_UNLIT : 0;
          tint.set(picked && (how === 'recolor' || how === 'glow') ? pale : color, at * 4);
        }
      }
      if (text && selectable(e))
        text.write(
          i,
          shown.cells.map((c) => c.text),
          editable(e)
            ? {
                value: String(e.value),
                copied: shown.copied,
                places: shown.places,
                carets: shown.carets,
              }
            : undefined,
        );
    }
    voice?.fade({ over: 0 });
    voice = m.cue({ name: 'values', patch: valueVoice(b, on, tint), subjects: b.dots, loop: true });
  };

  let last = performance.now();
  const away = awayGaps();
  /** Until when the lights may still be settling from the last change, ms. */
  let settling = 0;
  /** How long after a change its lights take to settle: several of their slowest fade. */
  const settleMs = () =>
    6 * Math.max(opts.fade?.rise ?? FADE.rise, opts.fade?.fall ?? FADE.fall) + 50;
  const frame = (now: number) => {
    let gap = now - last;
    last = now;
    if (away(gap)) {
      m.rebase();
      gap = 0;
    }
    if (shaped) {
      shaped = false;
      valued = true;
      reshape();
    }
    if (entries.some((e) => e.caret !== null)) {
      const on = Math.floor((now - caretAt) / BLINK_MS) % 2 === 0;
      if (on !== blinkOn) {
        blinkOn = on;
        valued = true;
      }
    }
    if (valued) {
      valued = false;
      play();
      settling = now + settleMs();
    }
    // With nothing changing, the last frame stands: no sync, no pull, no draw.
    const moved = placement.poll();
    if (moved) settling = Math.max(settling, now + settleMs());
    const busy =
      now < settling ||
      entries.some((e) => e.caret !== null || e.defects.length > 0) ||
      m.voices().length > 1;
    if (!busy) return;
    const t0 = performance.now();
    m.sync(now);
    pullChannels(m, layout.board, cols, cells, drawing.cpuChannels());
    if (marked && !drawing.webgpu) swapMarked(cols, marked);
    const t1 = performance.now();
    sign?.render(cols, AMBER, gap);
    text?.place(placement.fits);
    if (!opts.onFrame) return;
    const raw = { mixMs: t1 - t0, drawMs: performance.now() - t1 };
    mixMs += (raw.mixMs - mixMs) * 0.05;
    drawMs += (raw.drawMs - drawMs) * 0.05;
    opts.onFrame({ mixMs, drawMs, backend: drawing.backend, raw });
  };
  let mixMs = 0;
  let drawMs = 0;
  const stop = (opts.ticker ?? createTicker()).add(frame);

  const self: Surface = {
    backend: drawing.backend,
    readout(o) {
      const type = TYPES[o.type];
      if (!type) throw new Error(`blinken: no readout type named ${o.type}`);
      const e: Entry = {
        opts: o,
        value: o.value ?? '',
        color: o.color ?? (o.type === 'nixie' ? NIXIE : AMBER),
        defects: o.defects ?? [],
        slant: o.slant ?? 0,
        spot: {
          base: 0,
          first: 0,
          perLine: 1,
          lineSlots: 1,
          width: 1,
          height: 1,
          cells: [],
          underline: null,
        },
        picked: [],
        caret: null,
        selection: undefined,
        box: boxOf(o, canvas),
      };
      entries.push(e);
      shaped = true;
      const r: Readout = {
        get value() {
          return e.value;
        },
        set(value) {
          e.value = value;
          valued = true;
        },
        color(hex) {
          e.color = hex;
          valued = true;
        },
        moveTo(at, height) {
          e.box = boxOf({ ...o, at, height: height ?? o.height }, canvas);
        },
        setDefects(defects) {
          e.defects = defects;
          shaped = true;
        },
        setSelection(look) {
          e.selection = look;
          shaped = true;
        },
        destroy() {
          const i = entries.indexOf(e);
          if (i < 0) return;
          entries.splice(i, 1);
          shaped = true;
        },
      };
      return r;
    },
    destroy() {
      stop();
      text?.destroy();
      drawing.destroy();
      m.close();
    },
  };
  insides.set(self, { mix: m, layout: () => layout });
  return self;
}
