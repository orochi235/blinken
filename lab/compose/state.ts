import {
  type EffectSpec,
  type LayerSpec,
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
