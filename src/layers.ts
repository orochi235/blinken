import { type Handle, level, type Mix } from '@msb235/blits';
import type { Board, Pose, Subject } from './board.js';
import { LAYERS, type LayerSpec } from './builtins.js';
import type { ParamValue } from './params.js';
import { cueLayer } from './program.js';

/** A built-in's name with on, off or a weight, or a full spec under any name. */
export type LayerOption = boolean | number | LayerSpec;

/** A sign's layers, each looping for good at a weight that turns it on and off. */
export interface Layers {
  /** Turns a layer on or off, or sets the weight it plays at; `params` re-cue it with them. */
  set(name: string, on: boolean | number, params?: Readonly<Record<string, ParamValue>>): void;
}

const weightOf = (spec: LayerSpec, on: boolean | number) =>
  on === true ? (spec.weight ?? 1) : on === false ? 0 : on;

/** Cues every built-in layer off, then each of `given` as it asks; throws on a name it lacks. */
export function cueLayers(
  m: Mix<Subject, Pose>,
  b: Board,
  given: Partial<Record<string, LayerOption>> = {},
): Layers {
  type Weight = ReturnType<typeof level<Subject>>;
  const layers = new Map<string, { spec: LayerSpec; weight: Weight; voice: Handle<Subject> }>();
  const add = (name: string, spec: LayerSpec, on: boolean | number) => {
    const weight = level<Subject>(weightOf(spec, on));
    layers.set(name, { spec, weight, voice: cueLayer(m, b, spec, weight) });
  };
  for (const [name, spec] of Object.entries(LAYERS)) add(name, spec, false);
  for (const [name, v] of Object.entries(given)) {
    if (v === undefined) continue;
    const known = layers.get(name);
    if (typeof v === 'object') {
      known?.voice.fade({ over: 0 });
      add(name, v, true);
    } else if (known) known.weight.set(weightOf(known.spec, v));
    else throw new Error(`bree: no layer named ${name}`);
  }
  return {
    set(name, on, params) {
      const layer = layers.get(name);
      if (!layer) throw new Error(`bree: no layer named ${name}`);
      if (params) {
        const spec = { ...layer.spec, params: { ...layer.spec.params, ...params } };
        layer.voice.fade({ over: 0 });
        layer.voice = cueLayer(m, b, spec, layer.weight);
        layer.spec = spec;
      }
      layer.weight.set(weightOf(layer.spec, on));
    },
  };
}
