import { ControlPanel, f, isAuto } from '@weasel-js/labkit';
import { type EffectSpec, ORDERS, type OrderBy } from '@/index.js';
import { DENSITY, numberField, schemaFor } from '../schema.js';
import { BLEND, HOLD, LAG } from '../state.js';
import { editEffect } from './edit.js';

const NONE: ReadonlySet<string> = new Set();
const OWN_HOLD: ReadonlySet<string> = new Set(['hold']);

const schema = () =>
  schemaFor('whole', () => ({
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

/** The open effect as a whole: its order, its hold and its blend. */
export function WholeEffect({ spec }: { spec: EffectSpec }) {
  const set = (path: string, v: unknown) =>
    editEffect((e) => {
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
  return (
    <ControlPanel
      density={DENSITY}
      schema={schema()}
      config={{
        order: spec.order?.by ?? 'none',
        lag: spec.order?.lag ?? 0,
        hold: spec.hold ?? 0,
        blend: spec.blend ?? 0,
      }}
      auto={spec.hold === undefined ? OWN_HOLD : NONE}
      setConfig={set}
      draftConfig={set}
      className="compose-two-up"
      pack="pairs"
      layout="inline"
    />
  );
}
