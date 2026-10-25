import { ControlPanel, isAuto } from '@weasel-js/labkit';
import { effectOf, tuningOf } from '@/index.js';
import { DENSITY, numberField, schemaFor, shownValues, storedValue } from '../schema.js';
import { compose, pickedOf, useCompose, useEffects } from '../store.js';

/** The picked scene's effect's own settings, each at the effect's value until the scene sets it. */
export function SceneTuning() {
  const state = useCompose();
  const effects = useEffects();
  const at = pickedOf(state);
  const scene = state.program[at];
  if (!scene) return null;
  const tuning = tuningOf(effectOf(scene, effects));
  const names = Object.keys(tuning);
  if (names.length === 0)
    return <p className="compose-hint">This effect has nothing a scene can tune.</p>;
  const schema = schemaFor(`tuning:${JSON.stringify(tuning)}`, () =>
    Object.fromEntries(
      Object.entries(tuning).map(([k, p]) => [
        k,
        numberField(p).auto().describe(`${p.about} Auto keeps the effect’s own.`),
      ]),
    ),
  );
  const given = scene.params ?? {};
  const set = (path: string, v: unknown) =>
    compose.edit(
      (s) => {
        const was = s.program[at];
        if (!was) return;
        const { [path]: _, ...others } = was.params ?? {};
        const params = isAuto(v)
          ? others
          : { ...others, [path]: storedValue(tuning, path, v) as number };
        const { params: __, ...rest } = was;
        s.program[at] = Object.keys(params).length ? { ...rest, params } : rest;
      },
      { replay: at },
    );
  return (
    <ControlPanel
      schema={schema}
      config={shownValues(
        tuning,
        Object.fromEntries(names.map((k) => [k, given[k] ?? tuning[k]?.value])),
      )}
      auto={new Set(names.filter((k) => given[k] === undefined))}
      setConfig={set}
      draftConfig={set}
      density={DENSITY}
      className="compose-two-up"
      pack="pairs"
      layout="inline"
    />
  );
}
