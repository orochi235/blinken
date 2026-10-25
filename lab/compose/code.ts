import {
  BLEND,
  type EffectSpec,
  effectOf,
  HOLD,
  LAG,
  LAYERS,
  type LayerName,
  MODULATORS,
  MOVES,
  type NumberParam,
  type Params,
  type Piece,
  type Scene,
  SLOTS,
  type Slot,
  tuningOf,
  values,
} from '@/index.js';
import { type ComposeState, sceneLayerOf } from './state.js';

/** A number written as a 0xRRGGBB literal. */
class Hex {
  constructor(readonly n: number) {}
}

/** A number as it plays: clamped to `p`'s range, as staging and links read it. */
const held = (p: NumberParam, v: number | undefined) =>
  v === undefined ? undefined : values({ params: { v: p } }, { v }).v;

/** The settings `params` gives, as they play, with colors written as hex literals. */
const paramsCode = (
  thing: { readonly params: Params },
  params?: Readonly<Record<string, unknown>>,
) => {
  if (!params) return params;
  const playing = values(thing, params as never) as Readonly<Record<string, unknown>>;
  return Object.fromEntries(
    Object.keys(params).map((k) => {
      const p = thing.params[k];
      const v = playing[k];
      return [k, p && 'colors' in p && Array.isArray(v) ? v.map((c) => new Hex(c)) : v];
    }),
  );
};

const withLag = <O extends { readonly lag?: number }>(order: O | undefined) =>
  order?.lag === undefined ? order : { ...order, lag: held(LAG, order.lag) };

const withHex = (piece: Piece) => {
  const thing = 'mod' in piece ? MODULATORS[piece.mod] : MOVES[piece.move];
  const timed =
    'mod' in piece
      ? piece.spread && { spread: withLag(piece.spread) }
      : piece.order && { order: withLag(piece.order) };
  return { ...piece, ...timed, ...(piece.params && { params: paramsCode(thing, piece.params) }) };
};

const KEY_ORDER = ['name', 'about', 'order', 'enter', 'active', 'exit', 'hold', 'blend', 'params'];
const effectCode = (given: EffectSpec) => {
  const spec: EffectSpec = {
    ...given,
    order: withLag(given.order),
    hold: held(HOLD, given.hold),
    blend: held(BLEND, given.blend),
  };
  const out: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    const v = spec[key as keyof EffectSpec];
    if (v === undefined) continue;
    out[key] = SLOTS.includes(key as Slot) ? [v].flat().map((p) => withHex(p as Piece)) : v;
  }
  return out;
};

const quote = (s: string) => JSON.stringify(s);
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

/** A scene's tuning of its effect as it plays: each value held to the range of what it tunes. */
function tunedCode(scene: Scene, effects: ComposeState['effects']) {
  if (!scene.params) return undefined;
  let tuning: Params;
  try {
    tuning = tuningOf(effectOf(scene, effects));
  } catch {
    return scene.params;
  }
  return paramsCode({ params: tuning }, scene.params);
}

/** Whether two settings records hold the same values. */
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/** The composition as a `createMarquee` call: designed effects in full, built-ins by name. */
export function toCode(state: ComposeState): string {
  const effects = Object.fromEntries(
    Object.entries(state.effects).map(([name, spec]) => [name, effectCode(spec)]),
  );
  const program = state.program.map((scene) => {
    const { text, hex, effect, hold, face, style } = scene;
    // A layer that is on, as true where it keeps its built-in's settings.
    const layers = Object.fromEntries(
      (Object.keys(scene.layers ?? {}) as LayerName[]).flatMap((name): [string, unknown][] => {
        const { on, params } = sceneLayerOf(scene, name);
        if (!on) return [];
        const base = LAYERS[name];
        const mod = MODULATORS[base.mod];
        if (same(values(mod, params as never), values(mod, base.params as never)))
          return [[name, true]];
        return [[name, { params: paramsCode(mod, params) }]];
      }),
    );
    return {
      text,
      hex: new Hex(hex),
      effect,
      hold: held(HOLD, hold),
      params: tunedCode(scene, state.effects),
      face,
      style,
      ...(Object.keys(layers).length && { layers }),
    };
  });
  const opts = {
    ...(Object.keys(effects).length && { effects }),
    program,
  };
  return `createMarquee(canvas, ${lit(opts, 0, true)});\n`;
}
