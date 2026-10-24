import { type ArcSpec, type ArcVoice, type Handle, type Mix, oklab, patch } from '@msb235/blits';
import type { Pose, Subject } from './board.js';
import { MODULATORS } from './modulators/index.js';
import { SLOTS, type Slot } from './moves/index.js';
import { groupsOf, type Order, type Placed } from './orders.js';
import {
  type Piece,
  piecesOf,
  type SlotPieces,
  type StagedPiece,
  stagePiece,
  type Warning,
} from './pieces.js';

/** A message's coming on, standing and going, as pieces in each slot: plain data. */
export interface EffectSpec {
  readonly name: string;
  readonly about?: string;
  readonly enter?: SlotPieces;
  readonly active?: SlotPieces;
  readonly exit?: SlotPieces;
  /**
   * How long `active` plays, ms; an active piece with an `ms` setting left unset plays one pass
   * over it. Default: an active move's own length, else 0.
   */
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
  readonly warnings: readonly Warning[];
}

/** A modulator setting `tint` outweighs the scene color rather than averaging with it evenly. */
const TINT_WEIGHT = 3;

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
  const span = (groups.length - 1) * lag;
  const given = hold ?? effect.hold;
  const lists = SLOTS.map((slot) => piecesOf(effect[slot]));
  const pieceAt = (s: number, i: number) => (lists[s] ?? [])[i] as Piece;
  const stageAll = (subjects: readonly Subject[], keep: (piece: Piece) => boolean) =>
    SLOTS.map((slot, s) =>
      (lists[s] ?? []).filter(keep).map((piece) => stagePiece(piece, slot, at, subjects, given)),
    );
  // Every piece staged once on the first group gives the warnings and the part lengths.
  const first = stageAll(groups[0] ?? [], () => true);
  const warnings: Warning[] = [];
  if (at.text.rows > at.board.line)
    warnings.push({
      text: `the ${at.text.face.name} face is ${at.text.rows} rows tall, taller than the sign's ${at.board.line}-row lines, so the scene is skipped`,
    });
  SLOTS.forEach((slot, s) => {
    const pieces = first[s] ?? [];
    pieces.forEach((p, i) => {
      for (const w of p.warnings) warnings.push({ ...w, piece: i });
    });
    if (pieces.filter((p) => p.writes.includes('tint')).length > 1)
      warnings.push({ slot, text: `two pieces in ${slot} set tint` });
  });
  const lengths = first.map((pieces) => Math.max(0, ...pieces.map((p) => lengthOf(p.voice))));
  const activeMoves = (first[1] ?? []).flatMap((p, i) =>
    'move' in pieceAt(1, i) ? [lengthOf(p.voice)] : [],
  );
  const held = given ?? Math.max(0, ...activeMoves);
  const [enter = 0, , exit = 0] = lengths;
  const ms = span + enter + held + exit;

  /** An arc of `parts`, a `pin` voice in every part the effect has holding it to the shared lengths. */
  const arcOf = (
    parts: readonly (readonly StagedPiece[])[],
    pin: Omit<ArcVoice<Subject, Pose>, 'duration'>,
    active: number,
    start: number,
  ) => {
    const spec: { -readonly [K in Slot]?: ArcVoice<Subject, Pose>[] } = {};
    SLOTS.forEach((slot, s) => {
      if (lists[s]?.length === 0) return;
      const duration = s === 1 ? active : (lengths[s] as number);
      spec[slot] = [{ ...pin, duration }, ...(parts[s] ?? []).map(weighed)];
    });
    return {
      spec: { ...spec, hold: active, blend: effect.blend ?? 0 } as ArcSpec<Subject, Pose>,
      start,
    };
  };

  const tint = oklab(hex);
  const color = patch<Subject, Pose>(Math.max(1, ms), () => ({ tint }), { writes: ['tint'] });
  const dots = (pieces: readonly StagedPiece[], s: number) =>
    pieces.filter((_, i) => !onCells(pieceAt(s, i)));
  // The scene color spans each group's arc as one voice layered into every part.
  const arcs = groups.map((subjects, g) =>
    arcOf(
      g === 0 ? first.map(dots) : stageAll(subjects, (piece) => !onCells(piece)),
      { patch: color, subjects },
      held,
      g * lag,
    ),
  );
  // Border cells are one subject set for the whole effect: one arc, its active over every group's.
  const cells = first.map((pieces, s) => pieces.filter((_, i) => onCells(pieceAt(s, i))));
  if (cells.some((pieces) => pieces.length > 0)) {
    const blank = patch<Subject, Pose>(Math.max(1, ms), () => ({}), { writes: [] });
    arcs.push(arcOf(cells, { patch: blank, subjects: at.board.cells }, held + span, 0));
  }
  return { arcs, ms, warnings };
}

/** Cues a staged effect's arcs under `owner`, each at its start; one of several is named by its index. */
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
