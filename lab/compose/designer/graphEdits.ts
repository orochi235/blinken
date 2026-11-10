import type { DropRefusal, DropVerdict, ReconnectChange } from '@weasel-js/diagram';
import {
  type Channel,
  type EffectSpec,
  type Piece,
  piecesOf,
  type Slot,
  writesOf,
} from '@/index.js';
import { shelved } from '../library.js';
import { setPiece } from '../state.js';
import { builtinOf, editEffect } from './edit.js';
import { idOf, partOf, wireChoices } from './graph.js';
import type { Designer } from './open.js';

/*
 * What a drag on the effect diagram asks of the open effect, whether the effect allows it, and the
 * effect once it is done. Every edit is committed through `editEffect`, as a card's are.
 */

/** Where a piece stands: its slot, and its index there. */
type At = { slot: Slot; index: number };

/** An edit the diagram asks for. */
export type GraphEdit = { kind: 'rewire'; at: At; channel: Channel };

const nameOf = (p: Piece) => ('mod' in p ? p.mod : p.move);
const refuse = (reason: string): DropRefusal => ({ refuse: reason });

/** The piece a graph id names in `spec`, with where it stands, or null. */
function pieceAt(spec: EffectSpec, id: string): { at: At; piece: Piece } | null {
  const part = partOf(id);
  if (part?.kind !== 'piece') return null;
  const piece = piecesOf(spec[part.slot])[part.index];
  return piece ? { at: { slot: part.slot, index: part.index }, piece } : null;
}

/** The piece and channel a wire's edge id joins: `piece:…>channel:…`. */
function wireOf(edge: string): { piece: string; channel: Channel } | null {
  const [from, to, ...rest] = edge.split('>');
  const end = to === undefined ? null : partOf(to);
  if (rest.length > 0 || from === undefined || end?.kind !== 'channel') return null;
  return partOf(from)?.kind === 'piece' ? { piece: from, channel: end.channel } : null;
}

/** Whether `spec` allows `edit`: true, or a refusal saying why not. */
export function verdictOf(spec: EffectSpec, edit: GraphEdit): DropVerdict {
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
  const { slot, index } = edit.at;
  const piece = piecesOf(spec[slot])[index] as Piece;
  if (writesOf(piece)[0] === edit.channel) return spec;
  return setPiece(spec, slot, index, {
    ...piece,
    params: { ...piece.params, channel: edit.channel },
  });
}

/** The graph id the edited piece has once `edit` is made. */
export const pickAfter = (edit: GraphEdit): string => idOf({ kind: 'piece', ...edit.at });

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

/**
 * The rewire that dragging `end` of the wire `edge` onto `node` asks for: null where it asks
 * nothing, and a refusal where that end may not move.
 */
function rewireOf(
  spec: EffectSpec,
  edge: string,
  end: 'from' | 'to',
  node: string,
): GraphEdit | DropRefusal | null {
  const wire = wireOf(edge);
  const held = wire && pieceAt(spec, wire.piece);
  if (!held) return null;
  if (end === 'from') return refuse('a wire stays on its piece: drag its channel end');
  const onto = partOf(node);
  return onto?.kind === 'channel' ? { kind: 'rewire', at: held.at, channel: onto.channel } : null;
}

/** Whether the wire `edge`'s `end` may land on `node`. */
export function wireVerdict(
  spec: EffectSpec,
  edge: string,
  end: 'from' | 'to',
  node: string,
): DropVerdict {
  const r = rewireOf(spec, edge, end, node);
  return r === null ? false : 'refuse' in r ? r : verdictOf(spec, r);
}

/** What a reconnect the diagram reports asks for, or null for nothing. */
export function editOfReconnect(spec: EffectSpec, c: ReconnectChange): GraphEdit | null {
  const r = rewireOf(spec, c.edge, c.end, c.node);
  return r && !('refuse' in r) ? r : null;
}
