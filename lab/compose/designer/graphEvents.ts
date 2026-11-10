import type {
  DeleteReport,
  DropRefusal,
  DropVerdict,
  ItemDrop,
  ItemDropTarget,
  NodeMove,
  ReconnectChange,
} from '@weasel-js/diagram';
import { type Channel, type EffectSpec, MODULATORS, MOVES, type Piece, piecesOf } from '@/index.js';
import { partOf } from './graph.js';
import { type GraphEdit, pieceAt, refuse, slotVerdict, verdictOf } from './graphEdits.js';

/* What each drag the effect diagram reports asks of the open effect, as a `GraphEdit`. */

/** The piece and channel a wire's edge id joins: `piece:…>channel:…`. */
function wireOf(edge: string): { piece: string; channel: Channel } | null {
  const [from, to, ...rest] = edge.split('>');
  const end = to === undefined ? null : partOf(to);
  if (rest.length > 0 || from === undefined || end?.kind !== 'channel') return null;
  return partOf(from)?.kind === 'piece' ? { piece: from, channel: end.channel } : null;
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

/** The step a graph id names, as a slot, or null. */
const stepOf = (id: string | null | undefined) => {
  const part = id ? partOf(id) : null;
  return part?.kind === 'step' ? part.slot : null;
};

/** Whether the pieces `ids` may be dropped into the step `container`. */
export function stepVerdict(
  spec: EffectSpec,
  ids: readonly string[],
  container: string,
): DropVerdict {
  const slot = stepOf(container);
  if (!slot) return false;
  for (const id of ids) {
    const held = pieceAt(spec, id);
    if (!held) return false;
    const v = slotVerdict(held.piece, slot);
    if (v !== true) return v;
  }
  return true;
}

/**
 * The move a piece dragged into another step asks for, landing at `index` there; null for any other
 * drag, which leaves the effect as it is.
 */
export function editOfMove(spec: EffectSpec, move: NodeMove, index: number): GraphEdit | null {
  const held = pieceAt(spec, move.id);
  const slot = stepOf(move.parent);
  if (!held || !slot || slot === held.at.slot) return null;
  const edit: GraphEdit = { kind: 'move', from: held.at, to: { slot, index } };
  return verdictOf(spec, edit) === true ? edit : null;
}

/** A palette's item as the piece it adds, or null for anything else carried in. */
export function pieceOfItem(item: unknown): Piece | null {
  if (typeof item !== 'object' || item === null) return null;
  const { mod, move } = item as { mod?: unknown; move?: unknown };
  if (typeof mod === 'string' && Object.hasOwn(MODULATORS, mod)) return item as Piece;
  if (typeof move === 'string' && Object.hasOwn(MOVES, move)) return item as Piece;
  return null;
}

/**
 * The add a palette item dropped at `target` asks for: into the step it is dropped in, at the
 * place marked there; or, dropped on a step drawn as a node or on a piece, into that step, last or
 * before that piece.
 */
function addOf(spec: EffectSpec, item: unknown, target: ItemDropTarget): GraphEdit | null {
  const piece = pieceOfItem(item);
  if (!piece) return null;
  const into = stepOf(target.container);
  if (into) {
    const index = target.index ?? piecesOf(spec[into]).length;
    return { kind: 'add', piece, to: { slot: into, index } };
  }
  const on = target.target ? partOf(target.target) : null;
  if (on?.kind === 'step')
    return { kind: 'add', piece, to: { slot: on.slot, index: piecesOf(spec[on.slot]).length } };
  if (on?.kind === 'piece') return { kind: 'add', piece, to: { slot: on.slot, index: on.index } };
  return null;
}

/** Whether a palette item may be dropped at `target`. */
export function itemVerdict(spec: EffectSpec, item: unknown, target: ItemDropTarget): DropVerdict {
  const edit = addOf(spec, item, target);
  return edit ? verdictOf(spec, edit) : false;
}

/** What a palette item dropped on the diagram asks for, or null for nothing. */
export function editOfDrop(spec: EffectSpec, drop: ItemDrop): GraphEdit | null {
  const edit = addOf(spec, drop.item, drop);
  return edit && verdictOf(spec, edit) === true ? edit : null;
}

/** What Delete asks for: taking out the picked piece. Steps, channels, and wires stay. */
export function editOfDelete(spec: EffectSpec, removed: DeleteReport): GraphEdit | null {
  // A step picked reports its pieces too, and a step is never taken out.
  if (removed.nodes.some((id) => stepOf(id))) return null;
  for (const id of removed.nodes) {
    const held = pieceAt(spec, id);
    if (held) return { kind: 'remove', at: held.at };
  }
  return null;
}
