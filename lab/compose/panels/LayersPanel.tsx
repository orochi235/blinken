import { ControlPanel, f } from '@weasel-js/labkit';
import { LAYERS, type LayerName, MODULATORS, values } from '@/index.js';
import { RENDERERS } from '../ColorsRow.js';
import { fieldsOf, schemaFor } from '../schema.js';
import { layerOf } from '../state.js';
import { compose, useCompose } from '../store.js';
import './LayersPanel.css';

const schemaOf = (name: LayerName) =>
  schemaFor(`layer:${name}`, () => ({
    on: f.boolean(false).label('on'),
    ...fieldsOf(MODULATORS[LAYERS[name].mod].params),
  }));

/** One built-in layer: whether it is on, and its modulator's settings. */
function Layer({ name }: { name: LayerName }) {
  const state = useCompose();
  const layer = layerOf(state, name);
  const mod = MODULATORS[layer.mod];
  const config = { on: layer.on, ...values(mod, layer.params as never) };
  // Every write reads the layer as it stands now, so one setting's edit keeps the others'.
  const set = (path: string, v: unknown) =>
    compose.edit(
      (s) => {
        const l = layerOf(s, name);
        s.layers[name] =
          path === 'on' ? { ...l, on: v === true } : { ...l, params: { ...l.params, [path]: v } };
      },
      { layer: name },
    );
  return (
    <ControlPanel
      title={
        <span className="compose-title">
          {name} <span className="compose-about">{mod.about}</span>
        </span>
      }
      schema={schemaOf(name)}
      config={config}
      setConfig={set}
      draftConfig={set}
      renderers={RENDERERS}
      density="tight"
    />
  );
}

/** The layers under the program, each built-in one with its settings. */
export function LayersPanel() {
  return (
    <section className="compose-layers" aria-label="layers">
      <h2 className="compose-heading">layers</h2>
      {(Object.keys(LAYERS) as LayerName[]).map((name) => (
        <Layer key={name} name={name} />
      ))}
    </section>
  );
}
