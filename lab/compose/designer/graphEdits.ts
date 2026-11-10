import type { DropRefusal, DropVerdict } from '@weasel-js/diagram';
import { type Channel, type EffectSpec, MOVES, type Piece, piecesOf, writesOf } from '@/index.js';
import { shelved } from '../library.js';
import { movePiece, type PieceAt, setPiece } from '../state.js';
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
  | { kind: 'move'; from: PieceAt; to: PieceAt };

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

/** Whether `spec` allows `edit`: true, or a refusal saying why not. */
export function verdictOf(spec: EffectSpec, edit: GraphEdit): DropVerdict {
  if (edit.kind === 'move') {
    const held = pieceAt(spec, idOf({ kind: 'piece', ...edit.from }));
    const room = piecesOf(spec[edit.to.slot]).length - (edit.to.slot === edit.from.slot ? 1 : 0);
    if (!held || edit.to.index < 0 || edit.to.index > room) return false;
    return slotVerdict(held.piece, edit.to.slot);
  }
  const held = pieceAt(spec, idOf({ kind: 'piece', ...edit.at }));
  if (!held) return false;
  const choices = wireChoices(held.piece);
  const name = nameOf(held.piece);
  if (!choices) {
    const writes = writesOf(held.piece);
    return refuse(
      'move' in held.piece
        ? `${name} is a move, which draws on lit`
        : `${name}’s wire${writes.length > 1 ? 's are' : ' is'} fixed`,
    );
  }
  return choices.includes(edit.channel)
    ? true
    : refuse(`${name} can drive ${choices.join(', ')}, which mix alike`);
}

/** `spec` with `edit` made, or as it was where `edit` is refused. */
export function applied(spec: EffectSpec, edit: GraphEdit): EffectSpec {
  if (verdictOf(spec, edit) !== true) return spec;
  if (edit.kind === 'move') {
    const { from, to } = edit;
    return from.slot === to.slot && from.index === to.index ? spec : movePiece(spec, from, to);
  }
  const { slot, index } = edit.at;
  const piece = piecesOf(spec[slot])[index] as Piece;
  if (writesOf(piece)[0] === edit.channel) return spec;
  return setPiece(spec, slot, index, {
    ...piece,
    params: { ...piece.params, channel: edit.channel },
  });
}

/** The graph id the edited piece has once `edit` is made. */
export const pickAfter = (edit: GraphEdit): string =>
  idOf({ kind: 'piece', ...(edit.kind === 'move' ? edit.to : edit.at) });

/** Makes `edit` on the designer's open effect, as one undo step, and picks the piece it edited. */
export function commitEdit(designer: Designer, edit: GraphEdit): void {
  const name = designer.open();
  const spec =
    name === undefined ? undefined : (shelved(designer.library.get(), name) ?? builtinOf(name));
  // An edit that changes nothing would still copy a built-in and take an undo step.
  if (!spec || applied(spec, edit) === spec) return;
  editEffect(designer, (e) => applied(e, edit));
  designer.setPicked(pickAfter(edit));
}
