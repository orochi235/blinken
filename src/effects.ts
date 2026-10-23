import { type ArcSpec, type ArcVoice, type Handle, type Mix, oklab, patch } from '@msb235/blits';
import type { Pose, Subject } from './board.js';
import { MODULATORS } from './modulators/index.js';
import type { Slot } from './moves/index.js';
import { groupsOf, type Order, type Placed } from './orders.js';
import { type Piece, type SlotPieces, type StagedPiece, stagePiece } from './pieces.js';

/** A message's coming on, standing and going, as pieces in each slot: plain data. */
export interface EffectSpec {
  readonly name: string;
  readonly about?: string;
  readonly enter?: SlotPieces;
  readonly active?: SlotPieces;
  readonly exit?: SlotPieces;
  /** How long `active` plays, ms. Default: an active move's own length, else 0. */
  readonly hold?: number;
  /** A crossfade across each boundary, ms. Default 0. */
  readonly blend?: number;
  /** An order over the whole effect: one arc per group, each started a lag after the last. */
  readonly order?: Order;
}

/** An effect as the arcs that play it, each with its start on the owner's clock. */
export interface StagedEffect {
  readonly arcs: readonly { readonly spec: ArcSpec<Subject, Pose>; readonly start: number }[];
  /** How long it keeps the sign, from the owner's 0. */
  readonly ms: number;
  readonly warnings: readonly string[];
}

const SLOTS: readonly Slot[] = ['enter', 'active', 'exit'];
/** A modulator setting `tint` outweighs the step color rather than averaging with it evenly. */
const TINT_WEIGHT = 3;

const piecesOf = (p: SlotPieces | undefined): readonly Piece[] =>
  p === undefined ? [] : Array.isArray(p) ? (p as readonly Piece[]) : [p as Piece];

const lengthOf = (v: ArcVoice<Subject, Pose>) => v.duration ?? v.patch.duration;

const onCells = (piece: Piece) => 'mod' in piece && MODULATORS[piece.mod].on === 'cells';

const weighed = ({ voice, writes }: StagedPiece): ArcVoice<Subject, Pose> =>
  writes.includes('tint') && voice.weight === undefined ? { ...voice, weight: TINT_WEIGHT } : voice;

/**
 * An effect staged for a message in a color: its arcs, how long it lasts, and what to warn about.
 * `hold` overrides the effect's own.
 */
export function stageEffect(
  effect: EffectSpec,
  at: Placed,
  hex: number,
  hold?: number,
): StagedEffect {
  const groups = effect.order ? groupsOf(effect.order, at) : [at.board.dots];
  const lag = effect.order?.lag ?? 0;
  const warnings = new Set<string>();
  // Staged once per group; part lengths come from the first, and every group shares them.
  const staged = groups.map((subjects, g) =>
    SLOTS.map((slot) =>
      piecesOf(effect[slot])
        .filter((piece) => g === 0 || !onCells(piece))
        .map((piece) => stagePiece(piece, slot, at, subjects)),
    ),
  );
  const first = staged[0] ?? [];
  SLOTS.forEach((slot, s) => {
    const pieces = first[s] ?? [];
    for (const p of pieces) for (const w of p.warnings) warnings.add(w);
    if (pieces.filter((p) => p.writes.includes('tint')).length > 1)
      warnings.add(`two pieces in ${slot} set tint`);
  });
  const lengths = first.map((pieces) => Math.max(0, ...pieces.map((p) => lengthOf(p.voice))));
  const active = first[1] ?? [];
  const activeMoves = piecesOf(effect.active).flatMap((piece, i) => {
    const voice = active[i]?.voice;
    return 'move' in piece && voice ? [lengthOf(voice)] : [];
  });
  const held = hold ?? effect.hold ?? Math.max(0, ...activeMoves);
  const [enter = 0, , exit = 0] = lengths;
  const ms = (groups.length - 1) * lag + enter + held + exit;

  const tint = oklab(hex);
  const color = patch<Subject, Pose>(Math.max(1, ms), () => ({ tint }), { writes: ['tint'] });
  const arcs = staged.map((parts, g) => {
    const spec: { -readonly [K in Slot]?: ArcVoice<Subject, Pose>[] } = {};
    SLOTS.forEach((slot, s) => {
      if (piecesOf(effect[slot]).length === 0) return;
      const pieces = parts[s] ?? [];
      // The step color spans the arc as one voice layered into every part, its duration pinning
      // each group's part to the same length.
      const step: ArcVoice<Subject, Pose> = {
        patch: color,
        subjects: groups[g] as readonly Subject[],
        duration: s === 1 ? held : (lengths[s] as number),
      };
      spec[slot] = [step, ...pieces.map(weighed)];
    });
    return {
      spec: { ...spec, hold: held, blend: effect.blend ?? 0 } as ArcSpec<Subject, Pose>,
      start: g * lag,
    };
  });
  return { arcs, ms, warnings: [...warnings] };
}

/** Cues a staged effect's arcs under `owner`, each at its start; one of several is named by its group. */
export function cueEffect(
  m: Mix<Subject, Pose>,
  owner: Handle<Subject>,
  staged: StagedEffect,
  name: string,
): void {
  const many = staged.arcs.length > 1;
  staged.arcs.forEach(({ spec, start }, i) => {
    m.arc({ ...spec, name: many ? `${name} ${i}` : name, owner, start });
  });
}
