import { ControlPanel } from '@weasel-js/labkit';
import { useState } from 'react';
import { LAYERS, type LayerName, MODULATORS, type ParamValue, values } from '@/index.js';
import { RENDERERS } from '../ColorsRow.js';
import { Panel } from '../Panel.js';
import { DENSITY, fieldsOf, schemaFor, shownValues, storedValue } from '../schema.js';
import { sceneLayerOf, withLayer } from '../state.js';
import { compose, pickedOf, useCompose } from '../store.js';
import './LayersPanel.css';

const schemaOf = (name: LayerName) =>
  schemaFor(`layer:${name}`, () => fieldsOf(MODULATORS[LAYERS[name].mod].params));

/** The picked scene's layers, a row each: on or off, and the open one's settings beneath it. */
export function LayersPanel() {
  const state = useCompose();
  const at = pickedOf(state);
  const scene = state.program[at];
  const [open, setOpen] = useState<LayerName | null>(null);
  if (!scene) return null;
  // Every write reads the layer as it stands now, so one setting's edit keeps the others'.
  const set = (
    name: LayerName,
    change: (l: { on: boolean; params: Record<string, ParamValue> }) => object,
  ) =>
    compose.edit(
      (s) => {
        const was = s.program[at];
        if (!was) return;
        const l = sceneLayerOf(was, name);
        const params = (l.params ?? {}) as Record<string, ParamValue>;
        s.program[at] = withLayer(was, name, { on: l.on, params, ...change({ on: l.on, params }) });
      },
      { replay: at },
    );
  return (
    <Panel title={`layers of scene ${at + 1}`} className="compose-layers">
      <ol className="compose-layer-list">
        {(Object.keys(LAYERS) as LayerName[]).map((name) => {
          const layer = sceneLayerOf(scene, name);
          const mod = MODULATORS[layer.mod];
          const isOpen = open === name;
          return (
            <li key={name} className={isOpen ? 'compose-layer is-open' : 'compose-layer'}>
              <div className="compose-layer-row">
                <input
                  type="checkbox"
                  aria-label={`${name} on`}
                  title="Play this layer across this scene, under its message."
                  checked={layer.on}
                  onChange={(e) => set(name, () => ({ on: e.target.checked }))}
                />
                <button
                  type="button"
                  className="compose-layer-pick"
                  aria-expanded={isOpen}
                  title={isOpen ? 'Hide this layer’s settings.' : 'Show this layer’s settings.'}
                  onClick={() => setOpen(isOpen ? null : name)}
                >
                  <span className="compose-layer-name">{name}</span>
                  <span className="compose-about">{mod.about}</span>
                </button>
              </div>
              {isOpen && (
                <ControlPanel
                  className={layer.on ? 'compose-layer-settings' : 'compose-layer-settings is-off'}
                  schema={schemaOf(name)}
                  config={shownValues(mod.params, values(mod, layer.params as never))}
                  setConfig={(path, v) =>
                    set(name, (l) => ({
                      params: {
                        ...l.params,
                        [path]: storedValue(mod.params, path, v) as ParamValue,
                      },
                    }))
                  }
                  draftConfig={(path, v) =>
                    set(name, (l) => ({
                      params: {
                        ...l.params,
                        [path]: storedValue(mod.params, path, v) as ParamValue,
                      },
                    }))
                  }
                  renderers={RENDERERS}
                  density={DENSITY}
                />
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
