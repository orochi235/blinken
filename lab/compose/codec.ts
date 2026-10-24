import {
  EFFECTS,
  type EffectSpec,
  FACE_NAMES,
  type FaceName,
  LAYERS,
  type LayerName,
  MODULATORS,
  MOVES,
  type NumberParam,
  ORDERS,
  type Order,
  type Param,
  type Params,
  type ParamValue,
  type Piece,
  piecesOf,
  type Scene,
  SLOTS,
  type Slot,
} from '@/index.js';
import { AMBER } from '../demo.js';
import { BitReader, BitWriter, widthOf } from './bits.js';
import { HEX } from './readers.js';
import { BLEND, HOLD, LAG } from './state.js';

/*
 * A composition packed into bits, using what bree already knows: each move, modulator, order,
 * face, built-in effect and layer is its place in its registry, and each number is a count of its
 * setting's steps. Settings left at their defaults are not written. Any change to a registry's
 * order or a setting's range or step changes what old links mean, so it bumps VERSION.
 */
export const VERSION = 1;

/** What a link carries: the share shape that `parse` reads. */
export interface ShareData {
  effects: Record<string, EffectSpec>;
  program: Scene[];
  layers: Record<string, { on: boolean; params?: Record<string, ParamValue> }>;
}

const EFFECT_NAMES = Object.keys(EFFECTS);
const MOD_NAMES = Object.keys(MODULATORS);
const LAYER_NAMES = Object.keys(LAYERS) as LayerName[];
const movesIn = Object.fromEntries(
  SLOTS.map((slot) => [
    slot,
    Object.keys(MOVES).filter((m) => MOVES[m as keyof typeof MOVES].slot === slot),
  ]),
) as Record<Slot, string[]>;

/** About text that is a built-in's is written as which built-in. */
const ABOUT = { none: 0, builtin: 1, text: 2 } as const;

const stepsOf = (p: NumberParam) => Math.round((p.max - p.min) / p.step);
const onStep = (p: NumberParam, k: number) => Number((p.min + k * p.step).toPrecision(12));
const defaultOf = (p: Param): ParamValue => ('colors' in p ? p.colors : p.value);
const same = (a: ParamValue, b: ParamValue) => JSON.stringify(a) === JSON.stringify(b);

/** A number as its count of `p`'s steps; one off its steps or range escapes to a full float. */
function writeNumber(w: BitWriter, p: NumberParam, v: number): void {
  const steps = stepsOf(p);
  const k = Math.round((v - p.min) / p.step);
  if (k >= 0 && k <= steps && onStep(p, k) === v) w.uint(k, widthOf(steps + 2));
  else {
    w.uint(steps + 1, widthOf(steps + 2));
    w.float(v);
  }
}

function readNumber(r: BitReader, p: NumberParam): number {
  const k = r.index(stepsOf(p) + 2);
  return k === stepsOf(p) + 1 ? r.float() : onStep(p, k);
}

/** Whether `v` is of `p`'s kind, so it can be written as one. */
const fits = (p: Param, v: ParamValue) =>
  'colors' in p
    ? Array.isArray(v) && v.every((c) => typeof c === 'number')
    : 'choices' in p
      ? typeof v === 'string' && p.choices.includes(v)
      : typeof v === 'number';

/** Each of `params` that differs from `base`'s or its own default, flagged in the params' order. */
function writeParams(
  w: BitWriter,
  params: Params,
  given: Readonly<Record<string, ParamValue>> | undefined,
  base: Readonly<Record<string, ParamValue>> = {},
): void {
  for (const [key, p] of Object.entries(params)) {
    const v = given?.[key];
    const kept = v !== undefined && fits(p, v) && !same(v, base[key] ?? defaultOf(p));
    w.flag(kept);
    if (!kept) continue;
    if ('colors' in p) {
      w.count((v as number[]).length);
      for (const c of v as number[]) writeNumber(w, HEX, c);
    } else if ('choices' in p) w.uint(p.choices.indexOf(v as string), widthOf(p.choices.length));
    else writeNumber(w, p, v as number);
  }
}

function readParams(r: BitReader, params: Params): Record<string, ParamValue> | undefined {
  const out: Record<string, ParamValue> = {};
  for (const [key, p] of Object.entries(params)) {
    if (!r.flag()) continue;
    if ('colors' in p) out[key] = Array.from({ length: r.count() }, () => readNumber(r, HEX));
    else if ('choices' in p) out[key] = p.choices[r.index(p.choices.length)] as string;
    else out[key] = readNumber(r, p);
  }
  return Object.keys(out).length ? out : undefined;
}

function writeOrder(w: BitWriter, order: Order | undefined): void {
  w.flag(order !== undefined);
  if (!order) return;
  w.uint(ORDERS.indexOf(order.by), widthOf(ORDERS.length));
  w.flag(order.lag !== undefined);
  if (order.lag !== undefined) writeNumber(w, LAG, order.lag);
  w.flag(order.seed !== undefined);
  if (order.seed !== undefined) w.int(order.seed);
}

function readOrder(r: BitReader): Order | undefined {
  if (!r.flag()) return undefined;
  const by = ORDERS[r.index(ORDERS.length)] as Order['by'];
  const lag = r.flag() ? readNumber(r, LAG) : undefined;
  const seed = r.flag() ? r.int() : undefined;
  return { by, ...(lag !== undefined && { lag }), ...(seed !== undefined && { seed }) };
}

function writePiece(w: BitWriter, slot: Slot, piece: Piece): void {
  w.flag('mod' in piece);
  if ('mod' in piece) {
    w.uint(MOD_NAMES.indexOf(piece.mod), widthOf(MOD_NAMES.length));
    writeOrder(w, piece.spread);
    writeParams(w, MODULATORS[piece.mod].params, piece.params);
  } else {
    w.uint(movesIn[slot].indexOf(piece.move), widthOf(movesIn[slot].length));
    writeOrder(w, piece.order);
    writeParams(w, MOVES[piece.move].params, piece.params);
  }
}

function readPiece(r: BitReader, slot: Slot): Piece {
  if (r.flag()) {
    const mod = MOD_NAMES[r.index(MOD_NAMES.length)] as keyof typeof MODULATORS;
    const spread = readOrder(r);
    const params = readParams(r, MODULATORS[mod].params);
    return { mod, ...(spread && { spread }), ...(params && { params }) };
  }
  const move = movesIn[slot][r.index(movesIn[slot].length)] as keyof typeof MOVES;
  const order = readOrder(r);
  const params = readParams(r, MOVES[move].params);
  return { move, ...(order && { order }), ...(params && { params }) };
}

/** A piece writes only where its move belongs, so pieces from elsewhere are left out. */
const writable = (slot: Slot, p: Piece) =>
  'mod' in p ? Object.hasOwn(MODULATORS, p.mod) : movesIn[slot].includes(p.move);

function writeEffect(w: BitWriter, name: string, spec: EffectSpec): void {
  w.text(name);
  const builtin = EFFECT_NAMES.findIndex(
    (n) => EFFECTS[n as keyof typeof EFFECTS].about === spec.about,
  );
  const about = spec.about === undefined ? ABOUT.none : builtin >= 0 ? ABOUT.builtin : ABOUT.text;
  w.uint(about, 2);
  if (about === ABOUT.builtin) w.uint(builtin, widthOf(EFFECT_NAMES.length));
  if (about === ABOUT.text) w.text(spec.about as string);
  writeOrder(w, spec.order);
  for (const slot of SLOTS) {
    const pieces = piecesOf(spec[slot]).filter((p) => writable(slot, p));
    w.count(pieces.length);
    for (const p of pieces) writePiece(w, slot, p);
  }
  w.flag(spec.hold !== undefined);
  if (spec.hold !== undefined) writeNumber(w, HOLD, spec.hold);
  w.flag(spec.blend !== undefined);
  if (spec.blend !== undefined) writeNumber(w, BLEND, spec.blend);
}

function readEffect(r: BitReader): EffectSpec {
  const out: Record<string, unknown> = { name: r.text() };
  const about = r.uint(2);
  if (about === ABOUT.builtin)
    out.about = EFFECTS[EFFECT_NAMES[r.index(EFFECT_NAMES.length)] as keyof typeof EFFECTS].about;
  else if (about === ABOUT.text) out.about = r.text();
  else if (about !== ABOUT.none) throw new RangeError('bree: a link has an unknown about');
  const order = readOrder(r);
  if (order) out.order = order;
  for (const slot of SLOTS) {
    const pieces = Array.from({ length: r.count() }, () => readPiece(r, slot));
    if (pieces.length) out[slot] = pieces;
  }
  if (r.flag()) out.hold = readNumber(r, HOLD);
  if (r.flag()) out.blend = readNumber(r, BLEND);
  return out as unknown as EffectSpec;
}

function writeScene(w: BitWriter, scene: Scene, mine: string[]): void {
  const effect = scene.effect as string;
  w.text(scene.text);
  w.flag(scene.hex !== AMBER);
  if (scene.hex !== AMBER) writeNumber(w, HEX, scene.hex);
  w.flag(mine.includes(effect));
  if (mine.includes(effect)) w.uint(mine.indexOf(effect), widthOf(mine.length));
  else w.uint(EFFECT_NAMES.indexOf(effect), widthOf(EFFECT_NAMES.length));
  w.flag(scene.hold !== undefined);
  if (scene.hold !== undefined) writeNumber(w, HOLD, scene.hold);
  const face = typeof scene.face === 'string' ? FACE_NAMES.indexOf(scene.face) : -1;
  w.flag(face >= 0);
  if (face >= 0) w.uint(face, widthOf(FACE_NAMES.length));
  w.flag(scene.style?.reverse === true);
  w.flag(scene.style?.proportional === true);
}

function readScene(r: BitReader, mine: string[]): Scene {
  const text = r.text();
  const hex = r.flag() ? readNumber(r, HEX) : AMBER;
  const effect = r.flag()
    ? (mine[r.index(mine.length)] as string)
    : (EFFECT_NAMES[r.index(EFFECT_NAMES.length)] as string);
  const hold = r.flag() ? readNumber(r, HOLD) : undefined;
  const face = r.flag() ? (FACE_NAMES[r.index(FACE_NAMES.length)] as FaceName) : undefined;
  const reverse = r.flag();
  const proportional = r.flag();
  const style = { ...(reverse && { reverse }), ...(proportional && { proportional }) };
  return {
    text,
    hex,
    effect,
    ...(hold !== undefined && { hold }),
    ...(face !== undefined && { face }),
    ...(Object.keys(style).length && { style }),
  };
}

/** A layer's settings default to its built-in's, then to its modulator's. */
const layerParams = (name: LayerName) => {
  const base = LAYERS[name];
  return { params: MODULATORS[base.mod].params, base: base.params ?? {} };
};

/** The composition as bytes: the version, the layers, the effects, then the program. */
export function pack(data: ShareData): Uint8Array {
  const w = new BitWriter();
  w.uint(VERSION, 8);
  for (const name of LAYER_NAMES) {
    const layer = data.layers[name];
    w.flag(layer !== undefined);
    if (!layer) continue;
    w.flag(layer.on);
    const { params, base } = layerParams(name);
    writeParams(w, params, layer.params, base);
  }
  const mine = Object.keys(data.effects);
  w.count(mine.length);
  for (const name of mine) writeEffect(w, name, data.effects[name] as EffectSpec);
  const scenes = data.program.filter(
    (s) =>
      typeof s.effect === 'string' && (mine.includes(s.effect) || EFFECT_NAMES.includes(s.effect)),
  );
  w.count(scenes.length);
  for (const scene of scenes) writeScene(w, scene, mine);
  return w.done();
}

/** Bytes `pack` wrote, as the share shape; throws on anything that is not one. */
export function unpack(bytes: Uint8Array): ShareData {
  const r = new BitReader(bytes);
  if (r.uint(8) !== VERSION) throw new RangeError('bree: a link from another version');
  const layers: ShareData['layers'] = {};
  for (const name of LAYER_NAMES) {
    if (!r.flag()) continue;
    const on = r.flag();
    const params = readParams(r, layerParams(name).params);
    layers[name] = { on, ...(params && { params }) };
  }
  const effects: Record<string, EffectSpec> = {};
  const mine: string[] = [];
  for (let i = r.count(); i > 0; i--) {
    const spec = readEffect(r);
    mine.push(spec.name);
    // Defined, not assigned: a link's `__proto__` would otherwise set the prototype.
    Object.defineProperty(effects, spec.name, { value: spec, enumerable: true, writable: true });
  }
  const program = Array.from({ length: r.count() }, () => readScene(r, mine));
  return { effects, program, layers };
}
