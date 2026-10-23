import {
  EFFECTS,
  type EffectSpec,
  LAYERS,
  type LayerName,
  MODULATORS,
  MOVES,
  type NumberParam,
  ORDERS,
  type Order,
  type OrderBy,
  type Params,
  type ParamValue,
  type Piece,
  SLOTS,
  type Slot,
  type Step,
} from '@/index.js';
import { AMBER, demo } from '../demo.js';
import { BLEND, type ComposeState, HOLD, LAG } from './state.js';

/** The browser-storage key the current draft is kept under. */
export const DRAFT = 'bree-compose-draft';
/** Where the draft a link replaced is kept, so opening a link never loses one. */
export const PREVIOUS = 'bree-compose-draft-previous';

const HEX: NumberParam = { label: 'color', min: 0, max: 0xffffff, step: 1, value: 0 };

/** A fresh composition: no designed effects, no layers on, and the demo page's program. */
export const defaultState = (): ComposeState => ({
  effects: {},
  program: demo('HELLO FROM BLITS', AMBER),
  layers: {},
  editing: { step: 0 },
});

/** What a link carries: the composition, without what is open. */
const shareOf = (state: ComposeState) => ({
  effects: state.effects,
  program: state.program,
  layers: Object.fromEntries(
    Object.entries(state.layers).map(([name, { on, params }]) => [
      name,
      params ? { on, params } : { on },
    ]),
  ),
});

/** The composition as base64url JSON, for the URL hash. */
export function encode(state: ComposeState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(shareOf(state)));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const clamp = (v: unknown, p: NumberParam): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(p.max, Math.max(p.min, v)) : undefined;

/** An optional number clamped to `p`; one given that isn't a number is named in `dropped`. */
const optional = (v: unknown, p: NumberParam, what: string, dropped: string[]) => {
  const n = clamp(v, p);
  if (v !== undefined && n === undefined) dropped.push(what);
  return n;
};

/** Whether a link's name can key a plain object: `__proto__` would set its prototype instead. */
const safe = (name: string) => name !== '__proto__';

/** A link's map: its entries, or none (named in `dropped`) when it is there but not a map. */
const entriesOf = (v: unknown, what: string, dropped: string[]): [string, unknown][] => {
  if (v === undefined) return [];
  if (!isObj(v)) {
    dropped.push(what);
    return [];
  }
  return Object.entries(v);
};

/**
 * A link's settings for `thing`, in its own key order, each kept only if it is one it has, of its
 * kind; `values` clamps the numbers when it is staged.
 */
function paramsOf(
  thing: { readonly params: Params },
  given: unknown,
  where: string,
  dropped: string[],
): Record<string, ParamValue> | undefined {
  if (!isObj(given)) return undefined;
  const out: Record<string, ParamValue> = {};
  for (const [key, param] of Object.entries(thing.params)) {
    const v = given[key];
    if (v === undefined) continue;
    const kept =
      'colors' in param
        ? Array.isArray(v) && v.length > 0 && v.every((c) => clamp(c, HEX) !== undefined)
          ? v.map((c) => Math.round(clamp(c, HEX) as number))
          : undefined
        : 'choices' in param
          ? typeof v === 'string' && param.choices.includes(v)
            ? v
            : undefined
          : typeof v === 'number' && Number.isFinite(v)
            ? v
            : undefined;
    if (kept === undefined) dropped.push(`setting ${key} in ${where}`);
    else out[key] = kept;
  }
  for (const key of Object.keys(given))
    if (!Object.hasOwn(thing.params, key)) dropped.push(`setting ${key} in ${where}`);
  return Object.keys(out).length ? out : undefined;
}

function orderOf(v: unknown, where: string, dropped: string[]): Order | undefined {
  if (v === undefined) return undefined;
  if (!isObj(v) || !ORDERS.includes(v.by as OrderBy)) {
    dropped.push(`order in ${where}`);
    return undefined;
  }
  const lag = optional(v.lag, LAG, `lag in ${where}`, dropped);
  const seed = Number.isInteger(v.seed) ? (v.seed as number) : undefined;
  return {
    by: v.by as OrderBy,
    ...(lag !== undefined && { lag }),
    ...(seed !== undefined && { seed }),
  };
}

function pieceOf(v: unknown, slot: Slot, where: string, dropped: string[]): Piece | undefined {
  if (!isObj(v)) {
    dropped.push(`a piece in ${where}`);
    return undefined;
  }
  if (typeof v.move === 'string') {
    const move = Object.hasOwn(MOVES, v.move) ? MOVES[v.move as keyof typeof MOVES] : undefined;
    if (!move || move.slot !== slot) {
      dropped.push(`move ${v.move} in ${where}`);
      return undefined;
    }
    const order = orderOf(v.order, where, dropped);
    const params = paramsOf(move, v.params, where, dropped);
    return {
      move: v.move as keyof typeof MOVES,
      ...(order && { order }),
      ...(params && { params }),
    };
  }
  if (typeof v.mod === 'string') {
    const mod = Object.hasOwn(MODULATORS, v.mod)
      ? MODULATORS[v.mod as keyof typeof MODULATORS]
      : undefined;
    if (!mod) {
      dropped.push(`modulator ${v.mod} in ${where}`);
      return undefined;
    }
    const spread = orderOf(v.spread, where, dropped);
    const params = paramsOf(mod, v.params, where, dropped);
    return {
      mod: v.mod as keyof typeof MODULATORS,
      ...(spread && { spread }),
      ...(params && { params }),
    };
  }
  dropped.push(`a piece in ${where}`);
  return undefined;
}

function effectOf(name: string, v: unknown, dropped: string[]): EffectSpec | undefined {
  const slots = isObj(v)
    ? SLOTS.map((slot) => (v[slot] === undefined ? [] : isObj(v[slot]) ? [v[slot]] : v[slot]))
    : [];
  if (
    !isObj(v) ||
    !name ||
    !safe(name) ||
    Object.hasOwn(EFFECTS, name) ||
    !slots.every(Array.isArray)
  ) {
    dropped.push(`effect ${name}`);
    return undefined;
  }
  const out: Record<string, unknown> = { name };
  if (typeof v.about === 'string') out.about = v.about;
  const order = orderOf(v.order, name, dropped);
  if (order) out.order = order;
  SLOTS.forEach((slot, s) => {
    const pieces = (slots[s] as unknown[]).flatMap((p) => pieceOf(p, slot, name, dropped) ?? []);
    if (pieces.length) out[slot] = pieces;
  });
  const hold = optional(v.hold, HOLD, `hold in ${name}`, dropped);
  if (hold !== undefined) out.hold = hold;
  const blend = optional(v.blend, BLEND, `blend in ${name}`, dropped);
  if (blend !== undefined) out.blend = blend;
  return out as unknown as EffectSpec;
}

function stepOf(v: unknown, effects: ComposeState['effects'], dropped: string[]): Step | undefined {
  if (!isObj(v) || typeof v.text !== 'string') {
    dropped.push('a step');
    return undefined;
  }
  const effect = v.effect;
  if (
    typeof effect !== 'string' ||
    !(Object.hasOwn(effects, effect) || Object.hasOwn(EFFECTS, effect))
  ) {
    dropped.push(`step ${v.text}, its effect ${String(effect)}`);
    return undefined;
  }
  const hold = optional(v.hold, HOLD, `hold in step ${v.text}`, dropped);
  const hex = optional(v.hex, HEX, `color in step ${v.text}`, dropped);
  return {
    text: v.text,
    hex: Math.round(hex ?? AMBER),
    effect,
    ...(hold !== undefined && { hold }),
  };
}

/** What a link held: the composition, what of it was left out, and whether it read at all. */
export interface Decoded {
  state: ComposeState;
  dropped: string[];
  read: boolean;
}

/** A composition read from untrusted JSON, with everything it couldn't use named in `dropped`. */
function parse(data: unknown): Decoded {
  const dropped: string[] = [];
  const state = defaultState();
  if (!isObj(data)) return { state, dropped: [], read: false };
  state.effects = {};
  for (const [name, v] of entriesOf(data.effects, 'the effects', dropped)) {
    const spec = effectOf(name, v, dropped);
    if (spec) state.effects[name] = spec;
  }
  if (Array.isArray(data.program))
    state.program = data.program.flatMap((v) => stepOf(v, state.effects, dropped) ?? []);
  else {
    state.program = [];
    dropped.push('the program');
  }
  for (const [name, v] of entriesOf(data.layers, 'the layers', dropped)) {
    if (!Object.hasOwn(LAYERS, name) || !isObj(v)) {
      dropped.push(`layer ${name}`);
      continue;
    }
    const base = LAYERS[name as LayerName];
    const given = paramsOf(MODULATORS[base.mod], v.params, `layer ${name}`, dropped);
    const params = { ...base.params, ...given };
    state.layers[name] = {
      ...base,
      ...(Object.keys(params).length && { params }),
      on: v.on === true,
    };
  }
  return { state, dropped, read: true };
}

/**
 * A composition from a URL hash; anything unknown is left out and named, never thrown. `read` is
 * false when the hash is no composition at all, and `state` is then the default.
 */
export function decode(hash: string): Decoded {
  const text = hash.replace(/^#/, '');
  if (!text) return { state: defaultState(), dropped: [], read: false };
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch {
    return { state: defaultState(), dropped: [], read: false };
  }
}

/** Keeps the draft in browser storage; without storage it is simply not kept. */
export function save(state: ComposeState): void {
  try {
    localStorage.setItem(DRAFT, encode(state));
  } catch {}
}

const kept = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** The draft kept in browser storage, or null without one. */
export function load(): ComposeState | null {
  const draft = kept(DRAFT);
  const d = draft ? decode(draft) : null;
  return d?.read ? d.state : null;
}

/**
 * The composition a page opens with: a readable link's, after moving any different draft aside to
 * PREVIOUS; else the draft; else the default. `unreadable` says a link was there but read as none.
 */
export function open(hash: string): {
  state: ComposeState;
  dropped: string[];
  unreadable: boolean;
} {
  const linked = hash.replace(/^#/, '') ? decode(hash) : null;
  if (!linked?.read)
    return { state: load() ?? defaultState(), dropped: [], unreadable: linked !== null };
  const draft = kept(DRAFT);
  try {
    if (draft && draft !== encode(linked.state)) localStorage.setItem(PREVIOUS, draft);
  } catch {}
  save(linked.state);
  return { state: linked.state, dropped: linked.dropped, unreadable: false };
}

/** Whether a draft a link replaced is kept. */
export const hasPrevious = (): boolean => kept(PREVIOUS) !== null;

/** Swaps the draft a link replaced back in, keeping the link's as the previous one. */
export function restorePrevious(): ComposeState | null {
  const previous = kept(PREVIOUS);
  const d = previous ? decode(previous) : null;
  if (!d?.read) return null;
  const draft = kept(DRAFT);
  try {
    if (draft) localStorage.setItem(PREVIOUS, draft);
    else localStorage.removeItem(PREVIOUS);
  } catch {}
  save(d.state);
  return d.state;
}

export { toCode } from './code.js';
