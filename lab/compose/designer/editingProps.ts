import type { CanConnect, DiagramViewApi, DiagramViewProps, NodeMove } from '@weasel-js/diagram';
import { type EffectSpec, piecesOf, type Slot } from '@/index.js';
import { idOf, partOf } from './graph.js';
import { commitEdit } from './graphEdits.js';
import {
  editOfDelete,
  editOfDrop,
  editOfMove,
  editOfReconnect,
  itemVerdict,
  stepVerdict,
  wireVerdict,
} from './graphEvents.js';
import type { Designer } from './open.js';

const middleY = (r: { y: number; height: number }) => r.y + r.height / 2;

/** Where `moved` lands in `slot`: before the first of the slot's other pieces drawn below it. */
function landing(spec: EffectSpec, slot: Slot, moved: string, view: DiagramViewApi | null) {
  const others = piecesOf(spec[slot])
    .map((_, index) => idOf({ kind: 'piece', slot, index }))
    .filter((id) => id !== moved);
  const at = view?.rectOf(moved);
  if (!at) return others.length;
  return others.filter((id) => {
    const r = view?.rectOf(id);
    return r != null && middleY(r) < middleY(at);
  }).length;
}

/**
 * The `DiagramView` props that edit `spec`, the designer's open effect, by dragging on its diagram.
 * `view` reads where the diagram draws things; `relayout` puts back a drag that changed nothing.
 */
export function editingProps(
  designer: Designer,
  spec: EffectSpec,
  view: () => DiagramViewApi | null,
  relayout: () => void,
): Partial<DiagramViewProps> {
  const canConnect: CanConnect = (from, to, moving) => {
    if (!moving) return false;
    const node = (moving.end === 'to' ? to : from).nodeId;
    return wireVerdict(spec, moving.edge, moving.end, node);
  };
  // A piece dragged within its step, or into another, moves there; any other drag is put back.
  const onMove = (moves: readonly NodeMove[]) => {
    const move = moves.find((m) => partOf(m.id)?.kind === 'piece');
    if (!move) return;
    const own = partOf(move.id);
    const into =
      move.parent === undefined ? own : move.parent === null ? null : partOf(move.parent);
    const slot = into?.kind === 'step' || into?.kind === 'piece' ? into.slot : null;
    const edit = slot ? editOfMove(spec, move, landing(spec, slot, move.id, view())) : null;
    if (edit) commitEdit(designer, edit);
    else relayout();
  };
  return {
    connectBodies: true,
    canConnect,
    onReconnect: (change) => {
      const edit = editOfReconnect(spec, change);
      if (edit) commitEdit(designer, edit);
    },
    onMove,
    canReparent: (ids, container) => stepVerdict(spec, ids, container),
    canDropItem: (item, target) => itemVerdict(spec, item, target),
    onDropItem: (drop) => {
      const edit = editOfDrop(spec, drop);
      if (edit) commitEdit(designer, edit);
    },
    onDelete: (removed) => {
      const edit = editOfDelete(spec, removed);
      if (edit) commitEdit(designer, edit);
    },
  };
}
