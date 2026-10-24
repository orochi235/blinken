import {
  type BaseNode,
  type ConfigEntry,
  type ConfigShape,
  f,
  type ResolvedConfig,
  resolveConfigSchema,
} from '@weasel-js/labkit';
import type { NumberParam, Param, Params } from '@/index.js';

/** What a control multiplies a setting by to show it; 1 for any but a scaled number. */
const scaleOf = (p: Param | undefined) => (p && 'min' in p && p.scale) || 1;
const times = (n: number, by: number) => Number((n * by).toPrecision(12));

/** The control a NumberParam asks for: a slider over its range, in its step and unit, scaled to show. */
export const numberField = (p: NumberParam, label = p.label) => {
  const k = scaleOf(p);
  const node = f
    .number(times(p.value, k))
    .range(times(p.min, k), times(p.max, k))
    .step(times(p.step, k))
    .label(label)
    .describe(p.about)
    .slider();
  return p.unit ? node.suffix(p.unit) : node;
};

/** A thing's settings as its controls show them, each scaled number multiplied up. */
export const shownValues = (params: Params, values: Readonly<Record<string, unknown>>) =>
  Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      typeof v === 'number' ? times(v, scaleOf(params[k])) : v,
    ]),
  );

/** A value a control wrote, as the setting `key` stores it. */
export const storedValue = (params: Params, key: string, v: unknown) =>
  typeof v === 'number' ? Number((v / scaleOf(params[key])).toPrecision(12)) : v;

/** The control for one Param: a slider, a choice, or a row of colors (the `colors` renderer). */
export function fieldOf(p: Param): ConfigEntry {
  if ('colors' in p)
    return f
      .custom('colors', [...p.colors])
      .label(p.label)
      .describe(p.about);
  if ('choices' in p) return f.enum(p.value, p.choices).label(p.label).describe(p.about);
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

/** Fields whose rows take input only while the config's `on` holds. */
export const whileOn = (shape: ConfigShape): ConfigShape =>
  Object.fromEntries(
    Object.entries(shape).map(([k, node]) => [
      k,
      (node as BaseNode<unknown>).enableIf((c) => c.on === true),
    ]),
  );

/** How much room every settings panel in the lab gives its rows. */
export const DENSITY = 'roomy' as const;
