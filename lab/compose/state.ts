import {
  type EffectSpec,
  type FaceName,
  LAYERS,
  type LayerName,
  type LayerSpec,
  type NumberParam,
  type ParamValue,
  type Piece,
  piecesOf,
  type Scene,
  type Slot,
} from '@/index.js';

/** Everything the compose lab is editing: its effects, the program, and what is open. */
export interface ComposeState {
  effects: Record<string, EffectSpec>;
  program: Scene[];
  editing: { scene?: number };
}

/** A scene's layer as the lab keeps it: on or off, and the settings it changed. */
export interface LabLayer {
  on: boolean;
  params?: Record<string, ParamValue>;
}

/** An effect's or a scene's hold, an effect's blend and an order's lag, as the lab offers them. */
export const HOLD: NumberParam = {
  label: 'hold',
  min: 0,
  max: 12000,
  step: 50,
  value: 0,
  unit: 'ms',
  about:
    'How long the message stands on the sign between coming on and going. Auto uses the standing move’s own length.',
};
export const BLEND: NumberParam = {
  label: 'blend',
  min: 0,
  max: 1000,
  step: 10,
  value: 0,
  unit: 'ms',
  about:
    'How long each part of the effect crossfades into the next, coming on into standing and standing into going. At 0 they cut over at once.',
};
export const LAG: NumberParam = {
  label: 'lag',
  min: 0,
  max: 400,
  step: 1,
  value: 0,
  unit: 'ms',
  about:
    'How long each group of dots waits after the group before it, in the order chosen. At 0 they all go together; higher makes a slower sweep.',
};

/** A scene's layer with its built-in's settings under the scene's, off until turned on. */
export function sceneLayerOf(scene: Scene, name: LayerName): LayerSpec & { on: boolean } {
  const base = LAYERS[name];
  const v = scene.layers?.[name];
  if (v === undefined || typeof v === 'boolean') return { ...base, on: v === true };
  return { ...base, params: { ...base.params, ...v.params }, on: v.on !== false };
}

/** A scene with its layer `name` set to `layer`. */
export const withLayer = (scene: Scene, name: LayerName, layer: LabLayer): Scene => ({
  ...scene,
  layers: { ...scene.layers, [name]: layer },
});

/** An effect with a slot's pieces replaced, the slot left out when it has none. */
export function withSlot(spec: EffectSpec, slot: Slot, pieces: readonly Piece[]): EffectSpec {
  const { [slot]: _, ...rest } = spec;
  return pieces.length ? { ...rest, [slot]: pieces } : rest;
}

/** An effect with piece `i` of `slot` replaced. */
export const setPiece = (spec: EffectSpec, slot: Slot, i: number, piece: Piece): EffectSpec =>
  withSlot(
    spec,
    slot,
    piecesOf(spec[slot]).map((p, j) => (j === i ? piece : p)),
  );

/** An effect without piece `i` of `slot`. */
export const removePiece = (spec: EffectSpec, slot: Slot, i: number): EffectSpec =>
  withSlot(
    spec,
    slot,
    piecesOf(spec[slot]).filter((_, j) => j !== i),
  );

/** An effect with `piece` added last in `slot`. */
export const addPiece = (spec: EffectSpec, slot: Slot, piece: Piece): EffectSpec =>
  withSlot(spec, slot, [...piecesOf(spec[slot]), piece]);

/** The program with scene `i` moved `by` places, or as it was when that would leave the list. */
export function moveScene(program: readonly Scene[], i: number, by: number): Scene[] {
  const to = i + by;
  const out = [...program];
  if (to < 0 || to >= out.length || i < 0 || i >= out.length) return out;
  const [scene] = out.splice(i, 1);
  out.splice(to, 0, scene as Scene);
  return out;
}

/** A scene with its face or one of its style switches set, the default left out. */
export function withLook(scene: Scene, what: 'face' | 'reverse' | 'monospace', v: unknown): Scene {
  if (what === 'face') {
    const { face: _, ...rest } = scene;
    return v === 'standard' ? rest : { ...rest, face: v as FaceName };
  }
  const { style: _, ...rest } = scene;
  const { [what]: __, ...others } = scene.style ?? {};
  const style = v === true ? { ...others, [what]: true } : others;
  return Object.keys(style).length ? { ...rest, style } : rest;
}
