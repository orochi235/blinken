import { ControlPanel } from '@weasel-js/labkit';
import { LAYERS, type LayerName, MODULATORS, type ParamValue, values } from '@/index.js';
import { RENDERERS } from '../ColorsRow.js';
import { Panel } from '../Panel.js';
import { DENSITY, fieldsOf, schemaFor, shownValues, storedValue } from '../schema.js';
import { sceneLayerOf, withLayer } from '../state.js';
import { compose, pickedOf, useCompose } from '../store.js';
import '../Row.css';
import './LayersPanel.css';

const schemaOf = (name: LayerName) =>
  schemaFor(`layer:${name}`, () => fieldsOf(MODULATORS[LAYERS[name].mod].params));

/** The picked scene's layers, a row each: on or off, and an on layer's settings beneath it. */
export function LayersPanel() {
  const state = useCompose();
  const at = pickedOf(state);
  const scene = state.program[at];
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
      <ol className="compose-rows">
        {(Object.keys(LAYERS) as LayerName[]).map((name) => {
          const layer = sceneLayerOf(scene, name);
          const mod = MODULATORS[layer.mod];
          return (
            <li key={name}>
              <label
                className="compose-row compose-layer-row"
                data-picked={layer.on || undefined}
                title="Play this layer across this scene, under its message; its settings show while it is on."
              >
                <input
                  type="checkbox"
                  aria-label={`${name} on`}
                  checked={layer.on}
                  onChange={(e) => set(name, () => ({ on: e.target.checked }))}
                />
                <span className="compose-layer-name">{name}</span>
                <span className="compose-about">{mod.about}</span>
              </label>
              {layer.on && (
                <ControlPanel
                  className="compose-layer-settings"
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
