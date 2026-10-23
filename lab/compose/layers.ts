import { LAYERS, type LayerName, type LayerSpec, MODULATORS, values } from '@/index.js';
import { controlFor, h } from './controls.js';
import type { ComposeState } from './state.js';

/** A layer as the state holds it, off and at its built-in settings until changed. */
export const layerOf = (state: ComposeState, name: LayerName): LayerSpec & { on: boolean } =>
  state.layers[name] ?? { ...LAYERS[name], on: false };

/**
 * The layers under the program: each built-in one with a checkbox and its modulator's settings.
 * Every change lands in `state.layers`, then `onChange` runs with the layer's name.
 */
export function mountLayers(
  root: HTMLElement,
  state: ComposeState,
  onChange: (name: LayerName) => void,
): void {
  // Every write reads the layer as it stands now, so one setting's edit keeps the others'.
  const edit = (
    name: LayerName,
    fn: (l: LayerSpec & { on: boolean }) => LayerSpec & { on: boolean },
  ) => {
    state.layers[name] = fn(layerOf(state, name));
    onChange(name);
  };
  const card = (name: LayerName) => {
    const layer = layerOf(state, name);
    const mod = MODULATORS[layer.mod];
    const box = h('input');
    box.type = 'checkbox';
    box.checked = layer.on;
    box.addEventListener('change', () => edit(name, (l) => ({ ...l, on: box.checked })));
    const current = values(mod, layer.params as never) as Record<string, never>;
    const settings = Object.entries(mod.params).map(([key, param]) =>
      controlFor(key, param, current[key] as never, (v) =>
        edit(name, (l) => ({ ...l, params: { ...l.params, [key]: v } })),
      ),
    );
    const head = h(
      'label',
      'layer-head',
      box,
      h('strong', undefined, name),
      h('span', 'about', mod.about),
    );
    return h('div', 'layer', head, ...settings);
  };
  root.replaceChildren(
    h('header', 'pane-head', h('h2', undefined, 'layers')),
    ...(Object.keys(LAYERS) as LayerName[]).map(card),
  );
}
