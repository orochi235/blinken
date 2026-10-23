import { ControlPanel, f, isAuto } from '@weasel-js/labkit';
import { useState } from 'react';
import { EFFECTS, type EffectSpec, ORDERS, type OrderBy } from '@/index.js';
import { numberField, schemaFor } from '../schema.js';
import { BLEND, HOLD, LAG } from '../state.js';
import { compose } from '../store.js';
import { designerEdit, editEffect } from './edit.js';

const NONE: ReadonlySet<string> = new Set();
const OWN_HOLD: ReadonlySet<string> = new Set(['hold']);

const schema = () =>
  schemaFor('whole', () => ({
    name: f.string('').label('name'),
    order: f.enum<'none' | OrderBy>('none', ['none', ...ORDERS]).label('whole effect'),
    lag: numberField(LAG).showIf((c) => c.order !== 'none'),
    hold: numberField(HOLD).auto().describe('auto holds for the active move’s own length'),
    blend: numberField(BLEND),
  }));

/**
 * Gives the open effect another name, which the steps playing it follow. Says false, changing
 * nothing, when the name is empty or taken.
 */
function rename(from: string, to: string): boolean {
  if (to === from) return true;
  const taken =
    !to ||
    to === '__proto__' ||
    Object.hasOwn(EFFECTS, to) ||
    Object.hasOwn(compose.get().effects, to);
  if (taken) return false;
  designerEdit((s) => {
    const { [from]: spec, ...rest } = s.effects;
    s.effects = { ...rest, [to]: { ...(spec as EffectSpec), name: to } };
    s.program = s.program.map((step) => (step.effect === from ? { ...step, effect: to } : step));
    s.editing.effect = to;
  });
  return true;
}

/** The open effect as a whole: its name, its order, its hold and its blend. */
export function WholeEffect({ name, spec }: { name: string; spec: EffectSpec }) {
  const [refused, setRefused] = useState(0);
  const set = (path: string, v: unknown) => {
    if (path === 'name') {
      if (!rename(name, String(v).trim())) setRefused((n) => n + 1);
      return;
    }
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
  };
  return (
    <ControlPanel
      // Remounts on a refused rename, so the field drops what was typed.
      key={`${name}:${refused}`}
      schema={schema()}
      config={{
        name,
        order: spec.order?.by ?? 'none',
        lag: spec.order?.lag ?? 0,
        hold: spec.hold ?? 0,
        blend: spec.blend ?? 0,
      }}
      auto={spec.hold === undefined ? OWN_HOLD : NONE}
      setConfig={set}
      draftConfig={(path, v) => path !== 'name' && set(path, v)}
      density="tight"
    />
  );
}
