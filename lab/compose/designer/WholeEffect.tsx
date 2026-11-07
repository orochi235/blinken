import { ControlPanel, f, isAuto } from '@weasel-js/labkit';
import { useState } from 'react';
import { type EffectSpec, ORDERS, type OrderBy } from '@/index.js';
import { DENSITY, numberField, schemaFor } from '../schema.js';
import { BLEND, HOLD, LAG } from '../state.js';
import { editEffect, renameEffect } from './edit.js';
import { useDesigner } from './open.js';

const NONE: ReadonlySet<string> = new Set();
const OWN_HOLD: ReadonlySet<string> = new Set(['hold']);

const schema = () =>
  schemaFor('whole', () => ({
    name: f
      .string('')
      .label('name')
      .describe(
        'What the effect is called in the picker and in a shared composition. Scenes playing it follow a new name; renaming a built-in saves a copy under the new name. A name that is empty or already taken goes back.',
      ),
    order: f
      .enum<'none' | OrderBy>('none', ['none', ...ORDERS])
      .label('whole effect')
      .describe(
        'Staggers the whole effect over the sign: by column, from the center out, by row, letter by letter, or at random, each group a lag after the last. None plays every dot at once.',
      ),
    lag: numberField(LAG).showIf((c) => c.order !== 'none'),
    hold: numberField(HOLD).auto(),
    blend: numberField(BLEND),
  }));

/** The open effect as a whole: its name, its order, its hold and its blend. */
export function WholeEffect({ name, spec }: { name: string; spec: EffectSpec }) {
  const designer = useDesigner();
  const [refusals, setRefusals] = useState(0);
  const set = (path: string, v: unknown) =>
    editEffect(designer, (e) => {
      if (path === 'order') {
        const { order: _, ...rest } = e;
        return v === 'none' ? rest : { ...rest, order: { ...e.order, by: v as OrderBy } };
      }
      if (path === 'lag')
        return { ...e, order: { ...(e.order ?? { by: 'together' }), lag: Number(v) } };
      if (path === 'hold') {
        const { hold: _, ...rest } = e;
        return isAuto(v) ? rest : { ...rest, hold: Number(v) };
      }
      return { ...e, blend: Number(v) };
    });
  const commit = (path: string, v: unknown) => {
    if (path === 'name') {
      if (!renameEffect(designer, name, String(v).trim())) setRefusals((n) => n + 1);
    } else set(path, v);
  };
  const draft = (path: string, v: unknown) => {
    if (path !== 'name') set(path, v);
  };
  return (
    <ControlPanel
      // Remounts on a refused name, so the field drops the text it was refused.
      key={refusals}
      density={DENSITY}
      schema={schema()}
      config={{
        name,
        order: spec.order?.by ?? 'none',
        lag: spec.order?.lag ?? 0,
        hold: spec.hold ?? 0,
        blend: spec.blend ?? 0,
      }}
      auto={spec.hold === undefined ? OWN_HOLD : NONE}
      setConfig={commit}
      draftConfig={draft}
      className="compose-two-up"
      pack="pairs"
      layout="inline"
    />
  );
}
