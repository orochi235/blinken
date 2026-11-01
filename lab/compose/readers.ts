import {
  EFFECTS,
  type EffectParam,
  type EffectSpec,
  FACE_NAMES,
  type FaceName,
  LAYERS,
  type LayerName,
  LOOK,
  MODULATORS,
  MOVES,
  type NumberParam,
  ORDERS,
  type Order,
  type OrderBy,
  type Params,
  type ParamValue,
  type Piece,
  type Scene,
  SLOTS,
  type Slot,
  type TextStyle,
  tuningOf,
} from '@/index.js';
import { AMBER } from '../demo.js';
import { BLEND, type ComposeState, HOLD, LAG, type LabLayer, pruned } from './state.js';

/* Readers for each part of a link, each keeping only what it knows and naming the rest in `dropped`. */

export const HEX: NumberParam = {
  label: 'color',
  min: 0,
  max: 0xffffff,
  step: 1,
  value: 0,
  about: 'The color the message lights in.',
};

/** A seed a shuffle can use: a whole number the hash reads as itself, within 32 bits. */
export const isSeed = (v: unknown): v is number =>
  Number.isInteger(v) && Math.abs(v as number) <= 0x7fff_ffff;

export const isObj = (v: unknown): v is Record<string, unknown> =>
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
export const entriesOf = (v: unknown, what: string, dropped: string[]): [string, unknown][] => {
  if (v === undefined) return [];
  if (!isObj(v)) {
    dropped.push(what);
    return [];
  }
  return Object.entries(v);
};

/** Settings renamed since links were first written, old name to new, by what they belong to. */
const RENAMED = new Map<{ readonly params: Params }, Record<string, string>>([
  [MODULATORS.sparkle, { rate: 'share' }],
]);

/**
 * A link's settings for `thing`, in its own key order, each kept only if it is one it has, of its
 * kind; `values` clamps the numbers when it is staged.
 */
export function paramsOf(
  thing: { readonly params: Params },
  raw: unknown,
  where: string,
  dropped: string[],
): Record<string, ParamValue> | undefined {
  if (!isObj(raw)) return undefined;
  const renamed = RENAMED.get(thing) ?? {};
  const given: Record<string, unknown> = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      Object.hasOwn(renamed, k) ? (renamed[k] as string) : k,
      v,
    ]),
  );
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
  const seed = isSeed(v.seed) ? v.seed : undefined;
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

export function effectOf(name: string, v: unknown, dropped: string[]): EffectSpec | undefined {
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
  const params: Record<string, EffectParam> = {};
  for (const [key, p] of entriesOf(v.params, `params of ${name}`, dropped)) {
    const to = isObj(p) && Array.isArray(p.to) ? p.to.filter((t) => typeof t === 'string') : [];
    if (!safe(key) || !isObj(p) || to.length === 0) {
      dropped.push(`param ${key} of ${name}`);
      continue;
    }
    params[key] = {
      label: typeof p.label === 'string' ? p.label : key,
      about: typeof p.about === 'string' ? p.about : '',
      to,
    };
  }
  if (Object.keys(params).length) out.params = params;
  const spec = out as unknown as EffectSpec;
  // A param naming nothing the effect has is dropped, and named.
  const kept = pruned(spec);
  for (const key of Object.keys(spec.params ?? {}))
    if (!kept.params?.[key]) dropped.push(`param ${key} of ${name}`);
  return kept;
}

/** `legacy` reads a scene written while letters were monospace unless `proportional` was set. */
export function sceneOf(
  v: unknown,
  effects: ComposeState['effects'],
  dropped: string[],
  legacy = false,
): Scene | undefined {
  if (!isObj(v) || typeof v.text !== 'string') {
    dropped.push('a scene');
    return undefined;
  }
  const effect = v.effect;
  if (
    typeof effect !== 'string' ||
    !(Object.hasOwn(effects, effect) || Object.hasOwn(EFFECTS, effect))
  ) {
    dropped.push(`scene ${v.text}, its effect ${String(effect)}`);
    return undefined;
  }
  const hold = optional(v.hold, HOLD, `hold in scene ${v.text}`, dropped);
  const hex = optional(v.hex, HEX, `color in scene ${v.text}`, dropped);
  const face = faceIn(v.face, `face in scene ${v.text}`, dropped);
  const style = styleIn(v.style, `style in scene ${v.text}`, dropped, legacy);
  const spec = Object.hasOwn(effects, effect)
    ? effects[effect]
    : Object.hasOwn(EFFECTS, effect)
      ? (EFFECTS[effect as keyof typeof EFFECTS] as EffectSpec)
      : undefined;
  const tuning = spec ? tuningOf(spec) : {};
  const params = paramsOf({ params: tuning }, v.params, `scene ${v.text}`, dropped);
  const read = layersIn(v.layers, `scene ${v.text}`, dropped);
  const reversed = isObj(v.style) && v.style.reverse === true;
  const layers = reversed && !read?.invert ? { ...read, invert: { on: true } } : read;
  return {
    text: v.text,
    hex: Math.round(hex ?? AMBER),
    effect,
    ...(hold !== undefined && { hold }),
    ...(face !== undefined && { face }),
    ...(style !== undefined && { style }),
    ...(params && { params }),
    ...(layers !== undefined && { layers }),
  };
}

/** A link's layers, each a built-in's name with on and its changed settings; the rest dropped. */
export function layersIn(
  v: unknown,
  what: string,
  dropped: string[],
): Record<string, LabLayer> | undefined {
  if (v === undefined) return undefined;
  const out: Record<string, LabLayer> = {};
  for (const [name, layer] of entriesOf(v, `the layers of ${what}`, dropped)) {
    if (!Object.hasOwn(LAYERS, name) || !isObj(layer)) {
      dropped.push(`layer ${name} of ${what}`);
      continue;
    }
    const mod = MODULATORS[LAYERS[name as LayerName].mod];
    const params = paramsOf(mod, layer.params, `layer ${name} of ${what}`, dropped);
    out[name] = { on: layer.on === true, ...(params && Object.keys(params).length && { params }) };
  }
  return Object.keys(out).length ? out : undefined;
}

/** A link's face for a scene: a built-in's name, or none (named in `dropped`) when it is another. */
function faceIn(v: unknown, what: string, dropped: string[]): FaceName | undefined {
  if (v === undefined) return undefined;
  // The Not Jam faces were named `notjam-…` until 2026-10-24.
  const name = typeof v === 'string' ? v.replace(/^notjam-/, 'nj ') : v;
  if (typeof name === 'string' && FACE_NAMES.includes(name as FaceName)) return name as FaceName;
  dropped.push(what);
  return undefined;
}

const STYLES = ['monospace', 'outline', 'shadow'] as const;
const LEGACY_STYLES = ['proportional'] as const;

/**
 * A link's style for a scene: each switch it knows that is true, the rest named in `dropped`. A
 * `legacy` style's `proportional` is read as the absence of `monospace`. `reverse`, since
 * dropped, is left to the scene's reader, which plays the invert layer for it.
 */
function styleIn(
  v: unknown,
  what: string,
  dropped: string[],
  legacy: boolean,
): TextStyle | undefined {
  const known: readonly string[] = legacy ? LEGACY_STYLES : STYLES;
  const out: Record<string, boolean | number> = {};
  if (v !== undefined && !isObj(v)) dropped.push(what);
  else
    for (const [key, on] of Object.entries(v ?? {})) {
      if (key === 'reverse' && typeof on === 'boolean') continue;
      if (key === 'tracking' && !legacy) {
        const n = clamp(on, LOOK.params.tracking);
        if (n === undefined) dropped.push(`${key} in ${what}`);
        else if (n !== 0) out.tracking = Math.round(n);
        continue;
      }
      if (!known.includes(key) || typeof on !== 'boolean') dropped.push(`${key} in ${what}`);
      else if (on) out[key] = true;
    }
  if (legacy) {
    if (out.proportional) delete out.proportional;
    else out.monospace = true;
  }
  return Object.keys(out).length ? out : undefined;
}
