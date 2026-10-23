import {
  type ConfigEntry,
  type ConfigShape,
  f,
  type ResolvedConfig,
  resolveConfigSchema,
} from '@weasel-js/labkit';
import type { NumberParam, Param, Params } from '@/index.js';

/** The control a NumberParam asks for: a slider over its range, in its step and unit. */
export const numberField = (p: NumberParam, label = p.label) => {
  const node = f.number(p.value).range(p.min, p.max).step(p.step).label(label).slider();
  return p.unit ? node.suffix(p.unit) : node;
};

/** The control for one Param: a slider, a choice, or a row of colors (the `colors` renderer). */
export function fieldOf(p: Param): ConfigEntry {
  if ('colors' in p) return f.custom('colors', [...p.colors]).label(p.label);
  if ('choices' in p) return f.enum(p.value, p.choices).label(p.label);
  return numberField(p);
}

/** Every Param of a thing as schema fields, keyed as the thing keys them. */
export const fieldsOf = (params: Params): ConfigShape =>
  Object.fromEntries(Object.entries(params).map(([key, p]) => [key, fieldOf(p)]));

const cache = new Map<string, ResolvedConfig>();

/** A resolved panel schema, built once per `key`. */
export function schemaFor(key: string, build: () => ConfigShape): ResolvedConfig {
  let s = cache.get(key);
  if (!s) {
    s = resolveConfigSchema(f.schema(build()));
    cache.set(key, s);
  }
  return s;
}

/** A 0xRRGGBB number as a color input's `#rrggbb`, and back. */
export const hexOf = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
export const numOf = (hex: string) => Number.parseInt(hex.slice(1, 7), 16);
