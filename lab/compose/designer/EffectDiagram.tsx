import { DiagramView, diagramScene } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import { ToggleBar } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import { shelved, useLibrary } from '../library.js';
import { Panel } from '../Panel.js';
import { builtinOf } from './edit.js';
import { graphOf, partOf, VIEWS, type View, viewFor } from './graph.js';
import { designer, useDesk } from './open.js';
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
 * The open effect as a diagram, in the view the switch picks. Until the switch is touched, a pick
 * moves to the view that suits it. Mounted per open effect, so each starts in `both`.
 */
export function EffectDiagram() {
  useDesk();
  const shelf = useLibrary();
  const name = designer.open();
  const spec = name === undefined ? undefined : (shelved(shelf, name) ?? builtinOf(name));
  const staged = useStaged(spec, designer.text());
  const [view, setView] = useState<View>('both');
  const [chosen, setChosen] = useState(false);
  const data = useMemo(
    () => (spec ? graphOf(spec, view, staged?.parts ?? null) : null),
    [spec, view, staged],
  );
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
            if (!v) return;
            setChosen(true);
            setView(v);
          }}
        />
      }
    >
      {specs && spec ? (
        <div className="effects-diagram-canvas">
          <DiagramView
            specs={specs}
            selected={shown ? picked : null}
            onSelect={(id) => {
              designer.setPicked(id && partOf(id) ? id : undefined);
              const suits = id && !chosen ? viewFor(id, spec) : null;
              if (suits) setView(suits);
            }}
            anchor="start"
          />
        </div>
      ) : (
        <p className="compose-hint">Open an effect from the library to see it here.</p>
      )}
    </Panel>
  );
}
