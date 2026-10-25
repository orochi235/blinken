import {
  type EffectSpec,
  type FaceName,
  LAYERS,
  type LayerName,
  type LayerSpec,
  type ParamValue,
  type Piece,
  piecesOf,
  type Scene,
  type Slot,
  targetOf,
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

export { BLEND, HOLD, LAG } from '@/index.js';

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
  pruned(
    withSlot(
      spec,
      slot,
      piecesOf(spec[slot]).map((p, j) => (j === i ? piece : p)),
    ),
  );

/** An effect without piece `i` of `slot`; its params follow the pieces after it down a place. */
export const removePiece = (spec: EffectSpec, slot: Slot, i: number): EffectSpec =>
  pruned(
    withTargets(
      withSlot(
        spec,
        slot,
        piecesOf(spec[slot]).filter((_, j) => j !== i),
      ),
      (path) => {
        const [s, k, key] = path.split('.');
        if (s !== slot || k === undefined) return path;
        const at = Number(k);
        return at === i ? null : at > i ? `${s}.${at - 1}.${key}` : path;
      },
    ),
  );

/** An effect with each param's targets passed through `fn`, which drops one by giving null. */
function withTargets(spec: EffectSpec, fn: (path: string) => string | null): EffectSpec {
  if (!spec.params) return spec;
  const params = Object.fromEntries(
    Object.entries(spec.params).map(([name, p]) => [
      name,
      { ...p, to: p.to.flatMap((path) => fn(path) ?? []) },
    ]),
  );
  return { ...spec, params };
}

/** An effect whose params name only settings it has, a param left driving nothing dropped. */
export function pruned(spec: EffectSpec): EffectSpec {
  if (!spec.params) return spec;
  const kept = withTargets(spec, (path) => (targetOf(spec, path) ? path : null)).params ?? {};
  const params = Object.fromEntries(Object.entries(kept).filter(([, p]) => p.to.length > 0));
  const { params: _, ...rest } = spec;
  return Object.keys(params).length ? { ...rest, params } : rest;
}

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
export function withLook(
  scene: Scene,
  what: 'face' | 'monospace' | 'outline' | 'shadow',
  v: unknown,
): Scene {
  if (what === 'face') {
    const { face: _, ...rest } = scene;
    return v === 'standard' ? rest : { ...rest, face: v as FaceName };
  }
  const { style: _, ...rest } = scene;
  const { [what]: __, ...others } = scene.style ?? {};
  const style = v === true ? { ...others, [what]: true } : others;
  return Object.keys(style).length ? { ...rest, style } : rest;
}
