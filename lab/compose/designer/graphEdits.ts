import type { DropRefusal, DropVerdict } from '@weasel-js/diagram';
import { type Channel, type EffectSpec, MOVES, type Piece, piecesOf, writesOf } from '@/index.js';
import { shelved } from '../library.js';
import { addPiece, movePiece, type PieceAt, removePiece, setPiece } from '../state.js';
import { builtinOf, editEffect } from './edit.js';
import { idOf, partOf, wireChoices } from './graph.js';
import type { Designer } from './open.js';

/*
 * What a drag on the effect diagram asks of the open effect, whether the effect allows it, and the
 * effect once it is done. Every edit is committed through `editEffect`, as a card's are.
 */

/** An edit the diagram asks for. A move's `to.index` counts the pieces once it is out. */
export type GraphEdit =
  | { kind: 'rewire'; at: PieceAt; channel: Channel }
  | { kind: 'move'; from: PieceAt; to: PieceAt }
  | { kind: 'add'; piece: Piece; to: PieceAt }
  | { kind: 'remove'; at: PieceAt };

const nameOf = (p: Piece) => ('mod' in p ? p.mod : p.move);
export const refuse = (reason: string): DropRefusal => ({ refuse: reason });

/** The piece a graph id names in `spec`, with where it stands, or null. */
export function pieceAt(spec: EffectSpec, id: string): { at: PieceAt; piece: Piece } | null {
  const part = partOf(id);
  if (part?.kind !== 'piece') return null;
  const piece = piecesOf(spec[part.slot])[part.index];
  return piece ? { at: { slot: part.slot, index: part.index }, piece } : null;
}

/** Whether `piece` may play in `slot`: a move plays only in its own; a modulator anywhere. */
export function slotVerdict(piece: Piece, slot: PieceAt['slot']): DropVerdict {
  if ('mod' in piece) return true;
  const own = MOVES[piece.move].slot;
  return own === slot ? true : refuse(`${piece.move} is an ${own} move`);
}

/** Whether a one-curve modulator's wire may move to `channel`. */
function rewireVerdict(piece: Piece, channel: Channel): DropVerdict {
  const choices = wireChoices(piece);
  const name = nameOf(piece);
  if (choices)
    return choices.includes(channel)
      ? true
      : refuse(`${name} can drive ${choices.join(', ')}, which mix alike`);
  const writes = writesOf(piece);
  return refuse(
    'move' in piece
      ? `${name} is a move, which draws on lit`
      : `${name}’s wire${writes.length > 1 ? 's are' : ' is'} fixed`,
  );
}

const heldAt = (spec: EffectSpec, at: PieceAt) => pieceAt(spec, idOf({ kind: 'piece', ...at }));
const fits = (spec: EffectSpec, to: PieceAt, out = 0) =>
  to.index >= 0 && to.index <= piecesOf(spec[to.slot]).length - out;

/** Whether `spec` allows `edit`: true, or a refusal saying why not. */
export function verdictOf(spec: EffectSpec, edit: GraphEdit): DropVerdict {
  switch (edit.kind) {
    case 'rewire': {
      const held = heldAt(spec, edit.at);
      return held ? rewireVerdict(held.piece, edit.channel) : false;
    }
    case 'move': {
      const held = heldAt(spec, edit.from);
      const out = edit.to.slot === edit.from.slot ? 1 : 0;
      return held && fits(spec, edit.to, out) ? slotVerdict(held.piece, edit.to.slot) : false;
    }
    case 'add':
      return fits(spec, edit.to) ? slotVerdict(edit.piece, edit.to.slot) : false;
    case 'remove':
      return heldAt(spec, edit.at) !== null;
  }
}

/** `spec` with `edit` made, or as it was where `edit` is refused or changes nothing. */
export function applied(spec: EffectSpec, edit: GraphEdit): EffectSpec {
  if (verdictOf(spec, edit) !== true) return spec;
  switch (edit.kind) {
    case 'rewire': {
      const { slot, index } = edit.at;
      const piece = piecesOf(spec[slot])[index] as Piece;
      if (writesOf(piece)[0] === edit.channel) return spec;
      return setPiece(spec, slot, index, {
        ...piece,
        params: { ...piece.params, channel: edit.channel },
      });
    }
    case 'move': {
      const { from, to } = edit;
      return from.slot === to.slot && from.index === to.index ? spec : movePiece(spec, from, to);
    }
    case 'add':
      return addPiece(spec, edit.to.slot, edit.piece, edit.to.index);
    case 'remove':
      return removePiece(spec, edit.at.slot, edit.at.index);
  }
}

/** The graph id the edited piece has once `edit` is made; none for one taken out. */
export function pickAfter(edit: GraphEdit): string | undefined {
  if (edit.kind === 'remove') return undefined;
  return idOf({ kind: 'piece', ...(edit.kind === 'rewire' ? edit.at : edit.to) });
}

/** The designer's open effect, from its library or the built-ins. */
export function openSpec(designer: Designer): EffectSpec | undefined {
  const name = designer.open();
  return name === undefined
    ? undefined
    : (shelved(designer.library.get(), name) ?? builtinOf(name));
}

/** Makes `edit` on the designer's open effect, as one undo step, and picks the piece it edited. */
export function commitEdit(designer: Designer, edit: GraphEdit): void {
  const spec = openSpec(designer);
  // An edit that changes nothing would still copy a built-in and take an undo step.
  if (!spec || applied(spec, edit) === spec) return;
  editEffect(designer, (e) => applied(e, edit));
  designer.setPicked(pickAfter(edit));
}
