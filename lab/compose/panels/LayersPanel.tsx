import { ControlPanel, f } from '@weasel-js/labkit';
import { LAYERS, type LayerName, MODULATORS, type ParamValue, values } from '@/index.js';
import { RENDERERS } from '../ColorsRow.js';
import { Panel } from '../Panel.js';
import { DENSITY, fieldsOf, schemaFor, shownValues, storedValue, whileOn } from '../schema.js';
import { layerOf } from '../state.js';
import { compose, useCompose } from '../store.js';
import './LayersPanel.css';

const schemaOf = (name: LayerName) =>
  schemaFor(`layer:${name}`, () => ({
    // Drawn in the title, not as a row; here so the settings can be disabled by it.
    on: f.boolean(false).hidden(),
    ...whileOn(fieldsOf(MODULATORS[LAYERS[name].mod].params)),
  }));

/** One built-in layer: whether it is on, and its modulator's settings. */
function Layer({ name }: { name: LayerName }) {
  const state = useCompose();
  const layer = layerOf(state, name);
  const mod = MODULATORS[layer.mod];
  const config = {
    on: layer.on,
    ...shownValues(mod.params, values(mod, layer.params as never)),
  };
  // Every write reads the layer as it stands now, so one setting's edit keeps the others'.
  const set = (path: string, v: unknown) =>
    compose.edit(
      (s) => {
        const l = layerOf(s, name);
        s.layers[name] =
          path === 'on'
            ? { ...l, on: v === true }
            : {
                ...l,
                params: { ...l.params, [path]: storedValue(mod.params, path, v) as ParamValue },
              };
      },
      { layer: name },
    );
  return (
    <ControlPanel
      className={layer.on ? 'compose-layer-rows' : 'compose-layer-rows is-off'}
      title={
        <label
          className="compose-title"
          title="Turn this layer on to play it across the whole program, alongside every scene."
        >
          <input
            type="checkbox"
            aria-label={`${name} on`}
            checked={layer.on}
            onChange={(e) => set('on', e.target.checked)}
          />
          {name} <span className="compose-about">{mod.about}</span>
        </label>
      }
      schema={schemaOf(name)}
      config={config}
      setConfig={set}
      draftConfig={set}
      renderers={RENDERERS}
      density={DENSITY}
    />
  );
}

/** The layers under the program, each built-in one with its settings. */
export function LayersPanel() {
  return (
    <Panel title="layers" className="compose-layers">
      {(Object.keys(LAYERS) as LayerName[]).map((name) => (
        <Layer key={name} name={name} />
      ))}
    </Panel>
  );
}
