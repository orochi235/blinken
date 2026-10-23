import {
  board,
  EFFECTS,
  type EffectSpec,
  type NumberParam,
  type Piece,
  piecesOf,
  place,
  rasterize,
  SIZE,
  type Slot,
  stageEffect,
} from '@/index.js';
import { h, numberControl, options, orderControls } from './controls.js';
import { pieceCard, pieceOf, pieceSelect } from './piece.js';
import { type ComposeState, freeName } from './state.js';

const SLOTS: readonly Slot[] = ['enter', 'active', 'exit'];
const HOLD: NumberParam = { label: 'hold', min: 0, max: 12000, step: 50, value: 0, unit: 'ms' };
const BLEND: NumberParam = { label: 'blend', min: 0, max: 1000, step: 10, value: 0, unit: 'ms' };
const PREVIEW = board(SIZE.cols, SIZE.rows);

/** An effect with a slot's pieces replaced, the slot left out when it has none. */
function withSlot(spec: EffectSpec, slot: Slot, pieces: readonly Piece[]): EffectSpec {
  const { [slot]: _, ...rest } = spec;
  return pieces.length ? { ...rest, [slot]: pieces } : rest;
}

/** The slot a stage warning is about: one it names, else one holding the move it names. */
function slotOf(spec: EffectSpec, warning: string): Slot | undefined {
  const named = SLOTS.find((slot) => warning.includes(` in ${slot} `));
  if (named) return named;
  const move = warning.split(' ')[0];
  return SLOTS.find((slot) => piecesOf(spec[slot]).some((p) => 'move' in p && p.move === move));
}

/**
 * The effect designer: pick an effect, or start one, and edit its pieces, hold and blend. Every
 * edit lands in `state.effects`, then `onChange` runs.
 */
export function mountDesigner(root: HTMLElement, state: ComposeState, onChange: () => void): void {
  const name = () => state.editing.effect;
  const spec = () => {
    const n = name();
    return n === undefined ? undefined : state.effects[n];
  };
  const warnAt = new Map<Slot | 'effect', HTMLElement>();

  const refreshWarnings = () => {
    const s = spec();
    for (const el of warnAt.values()) el.replaceChildren();
    if (!s) return;
    const step = state.program[state.editing.step ?? 0];
    const text = step?.text ?? ' ';
    let warnings: readonly string[];
    try {
      const at = { ...place(PREVIEW, rasterize(text)), label: text };
      warnings = stageEffect(s, at, step?.hex ?? 0xffffff).warnings;
    } catch (e) {
      warnings = [(e as Error).message];
    }
    for (const w of warnings) warnAt.get(slotOf(s, w) ?? 'effect')?.append(h('p', 'warning', w));
  };

  const edit = (fn: (s: EffectSpec) => EffectSpec, rebuild = false) => {
    const n = name();
    const s = spec();
    if (n === undefined || !s) return;
    state.effects[n] = fn(s);
    if (rebuild) render();
    else refreshWarnings();
    onChange();
  };

  const open = (next: string | undefined) => {
    state.editing.effect = next;
    render();
    onChange();
  };

  const picker = () => {
    const select = h('select', 'picker');
    const yours = Object.keys(state.effects);
    options(select, ['pick an effect…'], '');
    select.options[0]?.setAttribute('value', '');
    const group = (label: string, names: readonly string[], prefix: string) => {
      const g = h('optgroup');
      g.label = label;
      for (const n of names) {
        const o = h('option', undefined, n);
        o.value = prefix + n;
        o.selected = prefix === 'y:' && n === name();
        g.append(o);
      }
      select.append(g);
    };
    if (yours.length) group('yours', yours, 'y:');
    group('built-in, as a copy', Object.keys(EFFECTS), 'b:');
    group('start', ['new effect'], 'n:');
    select.addEventListener('change', () => {
      const [kind, n] = [select.value.slice(0, 2), select.value.slice(2)];
      if (kind === 'y:') return open(n);
      if (kind === 'b:') {
        const copy = freeName(state, `${n} copy`);
        state.effects[copy] = { ...EFFECTS[n as keyof typeof EFFECTS], name: copy };
        return open(copy);
      }
      if (kind === 'n:') {
        const fresh = freeName(state, 'effect');
        state.effects[fresh] = { name: fresh, active: [{ move: 'stand' }], hold: 2000 };
        return open(fresh);
      }
      open(undefined);
    });
    return select;
  };

  const rename = (input: HTMLInputElement, from: string) => {
    const to = input.value.trim();
    if (to === from) return;
    if (!to || Object.hasOwn(state.effects, to) || Object.hasOwn(EFFECTS, to)) {
      input.value = from;
      return;
    }
    const { [from]: s, ...rest } = state.effects;
    state.effects = { ...rest, [to]: { ...(s as EffectSpec), name: to } };
    state.program = state.program.map((step) =>
      step.effect === from ? { ...step, effect: to } : step,
    );
    open(to);
  };

  const whole = (s: EffectSpec, n: string) => {
    const nameIn = h('input', 'name');
    nameIn.type = 'text';
    nameIn.value = n;
    nameIn.addEventListener('change', () => rename(nameIn, n));
    const order = orderControls(
      'whole effect',
      s.order,
      (o) => edit(({ order: _, ...rest }) => (o ? { ...rest, order: o } : rest)),
      { none: true },
    );
    const holdRow = numberControl({ ...HOLD, value: s.hold ?? 0 }, s.hold ?? 0, (v) =>
      edit((e) => ({ ...e, hold: v })),
    );
    const own = h('input');
    own.type = 'checkbox';
    own.checked = s.hold === undefined;
    holdRow.classList.toggle('off', own.checked);
    own.addEventListener('change', () => {
      holdRow.classList.toggle('off', own.checked);
      const v = Number(holdRow.querySelector('input')?.value ?? 0);
      edit(({ hold: _, ...rest }) => (own.checked ? rest : { ...rest, hold: v }));
    });
    const blend = numberControl(BLEND, s.blend ?? 0, (v) => edit((e) => ({ ...e, blend: v })));
    const ownRow = h(
      'label',
      'ctl',
      h('span', 'ctl-name', 'auto hold'),
      h('span', undefined, own, ' the active move’s own'),
    );
    const warn = h('div', 'warnings');
    warnAt.set('effect', warn);
    return h(
      'section',
      'whole',
      h('label', 'ctl', h('span', 'ctl-name', 'name'), nameIn),
      ...order,
      ownRow,
      holdRow,
      blend,
      warn,
    );
  };

  const slotBox = (s: EffectSpec, slot: Slot) => {
    const pieces = piecesOf(s[slot]);
    const set = (next: readonly Piece[], rebuild: boolean) =>
      edit((e) => withSlot(e, slot, next), rebuild);
    const cards = pieces.map((piece, i) =>
      pieceCard(
        slot,
        piece,
        (next, rebuild) =>
          set(
            pieces.map((p, j) => (j === i ? next : p)),
            rebuild,
          ),
        () =>
          set(
            pieces.filter((_, j) => j !== i),
            true,
          ),
      ),
    );
    const add = pieceSelect(slot, undefined, 'add a piece…');
    add.addEventListener('change', () => {
      if (add.value) set([...pieces, pieceOf(add.value)], true);
    });
    const warn = h('div', 'warnings');
    warnAt.set(slot, warn);
    return h('section', `slot slot-${slot}`, h('h3', undefined, slot), ...cards, add, warn);
  };

  const render = () => {
    warnAt.clear();
    const n = name();
    const s = spec();
    const head = h('header', 'designer-head', h('h2', undefined, 'effect'), picker());
    if (n === undefined || !s) {
      root.replaceChildren(
        head,
        h('p', 'hint', 'Pick an effect to edit, or start a new one. A built-in opens as a copy.'),
      );
      return;
    }
    if (s.about) head.append(h('span', 'about', s.about));
    root.replaceChildren(head, whole(s, n), ...SLOTS.map((slot) => slotBox(s, slot)));
    refreshWarnings();
  };

  render();
}
