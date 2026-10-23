import {
  type EffectSpec,
  LAYERS,
  type LayerName,
  MODULATORS,
  MOVES,
  type Params,
  type Piece,
  type Slot,
} from '@/index.js';
import type { ComposeState } from './state.js';

const SLOTS: readonly Slot[] = ['enter', 'active', 'exit'];

/** A number written as a 0xRRGGBB literal. */
class Hex {
  constructor(readonly n: number) {}
}

const hexParams = (
  thing: { readonly params: Params },
  params?: Readonly<Record<string, unknown>>,
) =>
  params &&
  Object.fromEntries(
    Object.entries(params).map(([k, v]) => {
      const p = thing.params[k];
      return [k, p && 'colors' in p && Array.isArray(v) ? v.map((c) => new Hex(c)) : v];
    }),
  );

const withHex = (piece: Piece) => {
  const thing = 'mod' in piece ? MODULATORS[piece.mod] : MOVES[piece.move];
  return piece.params ? { ...piece, params: hexParams(thing, piece.params) } : piece;
};

const KEY_ORDER = ['name', 'about', 'order', 'enter', 'active', 'exit', 'hold', 'blend'];
const effectCode = (spec: EffectSpec) => {
  const out: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    const v = spec[key as keyof EffectSpec];
    if (v === undefined) continue;
    out[key] = SLOTS.includes(key as Slot) ? [v].flat().map((p) => withHex(p as Piece)) : v;
  }
  return out;
};

const quote = (s: string) =>
  `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const keyOf = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k));
const WIDTH = 100;

/** `v` as source: inline where it fits in WIDTH at `indent`, else one entry per line. */
function lit(v: unknown, indent: number, force = false): string {
  if (v instanceof Hex) return `0x${v.n.toString(16).padStart(6, '0')}`;
  if (typeof v === 'string') return quote(v);
  if (typeof v !== 'object' || v === null) return String(v);
  const arr = Array.isArray(v);
  const entries = arr
    ? v.map((x) => ['', x])
    : Object.entries(v).filter(([, x]) => x !== undefined);
  if (!entries.length) return arr ? '[]' : '{}';
  const [open, close] = arr ? ['[', ']'] : ['{ ', ' }'];
  const part = ([k, x]: [string, unknown], at: number) =>
    arr ? lit(x, at) : `${keyOf(k)}: ${lit(x, at)}`;
  const flat = `${open}${entries.map((e) => part(e as [string, unknown], indent)).join(', ')}${close}`;
  if (!force && !flat.includes('\n') && indent + flat.length <= WIDTH) return flat;
  const pad = ' '.repeat(indent + 2);
  const lines = entries.map((e) => `${pad}${part(e as [string, unknown], indent + 2)},`);
  return `${open.trim()}\n${lines.join('\n')}\n${' '.repeat(indent)}${close.trim()}`;
}

/** Whether two settings records hold the same values. */
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/** The composition as a `createMarquee` call: designed effects in full, built-ins by name. */
export function toCode(state: ComposeState): string {
  const effects = Object.fromEntries(
    Object.entries(state.effects).map(([name, spec]) => [name, effectCode(spec)]),
  );
  const program = state.program.map(({ text, hex, effect, hold }) => ({
    text,
    hex: new Hex(hex),
    effect,
    hold,
  }));
  const layers = Object.fromEntries(
    Object.entries(state.layers).flatMap(([name, { on, ...spec }]) => {
      if (!on) return [];
      const base = LAYERS[name as LayerName];
      if (base && same(spec.params, base.params)) return [[name, true]];
      return [[name, { ...spec, params: hexParams(MODULATORS[spec.mod], spec.params) }]];
    }),
  );
  const opts = {
    ...(Object.keys(effects).length && { effects }),
    program,
    ...(Object.keys(layers).length && { layers }),
  };
  return `createMarquee(canvas, ${lit(opts, 0, true)});\n`;
}
