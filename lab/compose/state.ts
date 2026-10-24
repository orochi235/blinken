import {
  type EffectSpec,
  type FaceName,
  LAYERS,
  type LayerName,
  type LayerSpec,
  type NumberParam,
  type Piece,
  piecesOf,
  type Slot,
  type Step,
} from '@/index.js';

/** Everything the compose lab is editing: its effects, the program and layers, and what is open. */
export interface ComposeState {
  effects: Record<string, EffectSpec>;
  program: Step[];
  layers: Record<string, LayerSpec & { on: boolean }>;
  editing: { effect?: string; step?: number };
}

/** An effect's or a step's hold, an effect's blend and an order's lag, as the lab offers them. */
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

/** A layer as the state holds it, off and at its built-in settings until changed. */
export const layerOf = (state: ComposeState, name: LayerName): LayerSpec & { on: boolean } =>
  state.layers[name] ?? { ...LAYERS[name], on: false };

/** The effect a step falls back to when the one it named is deleted. */
export const FALLBACK = 'hold';

/** `base`, or `base 2`, `base 3`… whichever no effect in `state` is named yet. */
export function freeName(state: ComposeState, base: string): string {
  if (!Object.hasOwn(state.effects, base)) return base;
  for (let n = 2; ; n++) if (!Object.hasOwn(state.effects, `${base} ${n}`)) return `${base} ${n}`;
}

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

/** The program with step `i` moved `by` places, or as it was when that would leave the list. */
export function moveStep(program: readonly Step[], i: number, by: number): Step[] {
  const to = i + by;
  const out = [...program];
  if (to < 0 || to >= out.length || i < 0 || i >= out.length) return out;
  const [step] = out.splice(i, 1);
  out.splice(to, 0, step as Step);
  return out;
}

/** Deletes a designed effect; the steps that played it play the fallback built-in instead. */
export function deleteEffect(state: ComposeState, name: string): void {
  const { [name]: _, ...rest } = state.effects;
  state.effects = rest;
  state.program = state.program.map((step) =>
    step.effect === name ? { ...step, effect: FALLBACK } : step,
  );
  if (state.editing.effect === name) state.editing.effect = undefined;
}

/** A step with its face or one of its style switches set, the default left out. */
export function withLook(step: Step, what: 'face' | 'reverse' | 'proportional', v: unknown): Step {
  if (what === 'face') {
    const { face: _, ...rest } = step;
    return v === 'standard' ? rest : { ...rest, face: v as FaceName };
  }
  const { style: _, ...rest } = step;
  const { [what]: __, ...others } = step.style ?? {};
  const style = v === true ? { ...others, [what]: true } : others;
  return Object.keys(style).length ? { ...rest, style } : rest;
}
