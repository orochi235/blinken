import type { CanConnect, DiagramViewApi, DiagramViewProps, NodeMove } from '@weasel-js/diagram';
import { type EffectSpec, piecesOf, type Slot } from '@/index.js';
import { idOf, partOf } from './graph.js';
import { commitEdit } from './graphEdits.js';
import { editOfMove, editOfReconnect, stepVerdict, wireVerdict } from './graphEvents.js';
import type { Designer } from './open.js';

const middleY = (r: { y: number; height: number }) => r.y + r.height / 2;

/** Where a piece dropped into `slot` lands: before the first of its pieces drawn below it. */
function landing(spec: EffectSpec, slot: Slot, moved: string, view: DiagramViewApi | null) {
  const pieces = piecesOf(spec[slot]);
  const at = view?.rectOf(moved);
  if (!at) return pieces.length;
  const above = pieces.filter((_, index) => {
    const r = view?.rectOf(idOf({ kind: 'piece', slot, index }));
    return r !== null && r !== undefined && middleY(r) < middleY(at);
  });
  return above.length;
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
  const onMove = (moves: readonly NodeMove[]) => {
    for (const move of moves) {
      if (move.parent === undefined) continue;
      const step = move.parent === null ? null : partOf(move.parent);
      const index = step?.kind === 'step' ? landing(spec, step.slot, move.id, view()) : 0;
      const edit = editOfMove(spec, move, index);
      if (edit) commitEdit(designer, edit);
      else relayout();
      return;
    }
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
  };
}
