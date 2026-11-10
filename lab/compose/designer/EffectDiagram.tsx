import { DiagramView, type DiagramViewApi, diagramScene } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import { ToggleBar } from '@weasel-js/ui';
import { useMemo, useRef, useState } from 'react';
import { shelved, useLibrary } from '../library.js';
import { Panel } from '../Panel.js';
import { builtinOf } from './edit.js';
import { editingProps } from './editingProps.js';
import { graphOf, partOf, VIEWS, type View } from './graph.js';
import { useDesk } from './open.js';
import { PiecePalette } from './PiecePalette.js';
import { useStaged } from './staged.js';
import './EffectDiagram.css';

registerCanvasFont('sans-serif');
const FONT = { fontFamily: 'sans-serif', fontSize: 12 } as const;

const TIPS: Record<View, string> = {
  signal: 'Each piece wired to the channels it drives, and the channels to the sign.',
  time: 'Enter, active and exit in order, with how long each lasts and the pieces in it.',
  both: 'The steps in order holding their pieces, each piece wired to the channels it drives.',
};

/**
 * The open effect as a diagram, in the view the switch picks, edited by dragging on it and from the
 * palette beside it. Mounted per open effect, so each starts in `both`.
 */
export function EffectDiagram() {
  const designer = useDesk();
  const shelf = useLibrary();
  const name = designer.open();
  const spec = name === undefined ? undefined : (shelved(shelf, name) ?? builtinOf(name));
  const staged = useStaged(spec, designer.text());
  const [view, setView] = useState<View>('both');
  // A picked wire is the diagram's alone: no card stands for it.
  const [wire, setWire] = useState<string | null>(null);
  const api = useRef<DiagramViewApi>(null);
  // Bumped to lay the diagram out afresh after a drag that left the effect as it was.
  const [layout, setLayout] = useState(0);
  const data = useMemo(
    () => (spec ? graphOf(spec, view, staged?.parts ?? null) : null),
    [spec, view, staged],
  );
  // Piece ids are places, so a piece dragged to where another now stands would keep that place:
  // a change to which pieces stand where lays the diagram out afresh.
  const places = data?.nodes
    .filter((n) => n.id.startsWith('piece:'))
    .map((n) => `${n.id}=${n.lines?.[0]}`)
    .join(' ');
  const specs = useMemo(
    () => (data ? diagramScene(data, { font: FONT, layoutOptions: { direction: 'right' } }) : null),
    [data],
  );
  const picked = designer.picked() ?? null;
  const shown =
    picked !== null &&
    (data?.nodes.some((n) => n.id === picked) || data?.containers?.some((c) => c.id === picked));
  return (
    <Panel
      title="diagram"
      className="effects-diagram"
      actions={
        <ToggleBar
          size="sm"
          ariaLabel="view"
          items={VIEWS.map((v) => ({ value: v, label: v, tooltip: TIPS[v] }))}
          value={view}
          onChange={(v) => {
            if (v) setView(v);
          }}
        />
      }
    >
      {specs && spec ? (
        <div className="effects-diagram-body">
          <PiecePalette />
          <div className="effects-diagram-canvas">
            <DiagramView
              key={`${layout} ${places}`}
              ref={api}
              specs={specs}
              selected={shown ? picked : wire}
              onSelect={(id) => {
                setWire(id && !partOf(id) ? id : null);
                designer.setPicked(id && partOf(id) ? id : undefined);
              }}
              anchor="start"
              {...editingProps(
                designer,
                spec,
                () => api.current,
                () => setLayout((n) => n + 1),
              )}
            />
          </div>
        </div>
      ) : (
        <p className="compose-hint">Open an effect from the library to see it here.</p>
      )}
    </Panel>
  );
}
