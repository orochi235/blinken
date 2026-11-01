import {
  EFFECTS,
  type EffectSpec,
  LAYERS,
  type LayerName,
  MODULATORS,
  MOVES,
  type Params,
  SLOTS,
  type Slot,
  tuningOf,
} from '@/index.js';

/*
 * What a link names by its place in a registry, and how each registry and setting has grown since
 * links began, so a link reads against the registries and settings it was written with.
 */

export const EFFECT_NAMES = Object.keys(EFFECTS);
export const MOD_NAMES = Object.keys(MODULATORS);
export const LAYER_NAMES = Object.keys(LAYERS) as LayerName[];
/**
 * The layers a version 1 link wrote program-wide and a version 2 link wrote per scene, in their
 * order, whatever LAYERS holds now. Chase has since moved to the sign's border, so it is read and
 * dropped.
 */
export const V1_LAYERS = ['sparkle', 'chase', 'rainbow'] as const;
export const V2_LAYERS = ['sparkle', 'chase', 'rainbow', 'invert'] as const;
export const movesIn = Object.fromEntries(
  SLOTS.map((slot) => [
    slot,
    Object.keys(MOVES).filter((m) => MOVES[m as keyof typeof MOVES].slot === slot),
  ]),
) as Record<Slot, string[]>;

/** How long each registry was in links up to version `until`, oldest first. */
const LENGTHS: readonly {
  until: number;
  moves: Readonly<Record<Slot, number>>;
  mods: number;
  effects: number;
  layers: number;
}[] = [{ until: 10, moves: { enter: 6, active: 4, exit: 6 }, mods: 12, effects: 7, layers: 3 }];

/** The registries a link of `version` names its moves, modulators, effects and layers from. */
export interface Registries {
  movesIn: Readonly<Record<Slot, readonly string[]>>;
  mods: readonly string[];
  effects: readonly string[];
  layers: readonly string[];
}

export function registriesAt(version: number): Registries {
  const at = LENGTHS.find((l) => version <= l.until);
  if (!at) return { movesIn, mods: MOD_NAMES, effects: EFFECT_NAMES, layers: LAYER_NAMES };
  return {
    movesIn: Object.fromEntries(SLOTS.map((s) => [s, movesIn[s].slice(0, at.moves[s])])) as Record<
      Slot,
      string[]
    >,
    mods: MOD_NAMES.slice(0, at.mods),
    effects: EFFECT_NAMES.slice(0, at.effects),
    layers: LAYER_NAMES.slice(0, at.layers),
  };
}

/** Settings added by name since links began, by the version that added them. */
type Added = Record<number, Record<string, readonly string[]>>;

/** Built-in effects' params added since version 5. */
const ADDED: Added = {
  6: { scroll: ['direction'] },
  10: { tile: ['rows', 'gap'] },
  12: { type: ['pace'] },
};

/** Moves' settings added since version 11. */
export const MOVE_ADDED: Added = {
  12: { 'type-on': ['pace'], 'type-off': ['pace'] },
};

/** `params` as `name` had them in a link of `version`: today's, less what `added` says came later. */
export function paramsAt(params: Params, name: string, version: number, added: Added): Params {
  const later = new Set(
    Object.entries(added).flatMap(([v, by]) => (Number(v) > version ? (by[name] ?? []) : [])),
  );
  return Object.fromEntries(Object.entries(params).filter(([k]) => !later.has(k)));
}

/** What a scene could tune on `effect` in a link of `version`. */
export const tuningAt = (effect: EffectSpec, version: number): Params =>
  paramsAt(tuningOf(effect), effect.name, version, ADDED);
