import type { CanConnect, DiagramViewProps } from '@weasel-js/diagram';
import type { EffectSpec } from '@/index.js';
import { commitEdit, editOfReconnect, wireVerdict } from './graphEdits.js';
import type { Designer } from './open.js';

/** The `DiagramView` props that edit `spec`, the designer's open effect, by dragging on its diagram. */
export function editingProps(designer: Designer, spec: EffectSpec): Partial<DiagramViewProps> {
  const canConnect: CanConnect = (from, to, moving) => {
    if (!moving) return false;
    const node = (moving.end === 'to' ? to : from).nodeId;
    return wireVerdict(spec, moving.edge, moving.end, node);
  };
  return {
    connectBodies: true,
    canConnect,
    onReconnect: (change) => {
      const edit = editOfReconnect(spec, change);
      if (edit) commitEdit(designer, edit);
    },
  };
}
