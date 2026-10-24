import { f } from '@weasel-js/labkit';
import { stereo } from '@weasel-js/ui/components/MotifFrame';
import { FADE, type NumberParam } from '@/index.js';
import { numberField, schemaFor } from './schema.js';

const share = (label: string): NumberParam => ({ label, min: 0, max: 0.2, step: 0.005, value: 0 });
const leak = (label: string): NumberParam => ({ label, min: 0, max: 0.3, step: 0.005, value: 0 });

/** Each group of the sign's hardware settings. */
const GROUPS = {
  fade: {
    rise: { label: 'rise', min: 0, max: 200, step: 1, value: FADE.rise, unit: 'ms' },
    fall: { label: 'fall', min: 0, max: 1000, step: 5, value: FADE.fall, unit: 'ms' },
  },
  ghost: { row: leak('row'), col: leak('column') },
  defects: {
    dead: share('dead'),
    dim: share('dim'),
    flicker: share('flicker'),
    stuck: share('stuck on'),
    seed: { label: 'seed', min: 1, max: 50, step: 1, value: 1 },
  },
} satisfies Record<string, Record<string, NumberParam>>;

type Group = keyof typeof GROUPS;
/** How the sign's lights fade, how much they ghost, and which are broken. */
export type Hardware = { [G in Group]: Record<keyof (typeof GROUPS)[G], number> };

const entries = <T extends object>(o: T) => Object.entries(o) as [keyof T & string, T[keyof T]][];

export const HARDWARE: Hardware = Object.fromEntries(
  entries(GROUPS).map(([g, params]) => [
    g,
    Object.fromEntries(entries(params).map(([k, p]) => [k, (p as NumberParam).value])),
  ]),
) as Hardware;

/** The hardware panel's schema: a group per card, so a value sits at `fade.rise`. */
export const hardwareSchema = () =>
  schemaFor('hardware', () =>
    Object.fromEntries(
      entries(GROUPS).map(([g, params]) => [
        g,
        f
          .group(
            Object.fromEntries(entries(params).map(([k, p]) => [k, numberField(p as NumberParam)])),
          )
          .label(g)
          .motif(stereo()),
      ]),
    ),
  );

/** Hardware read back from storage, each value kept only when it is a number. */
export function hardwareOf(kept: unknown): Hardware {
  const k = (kept ?? {}) as Record<string, Record<string, unknown>>;
  return Object.fromEntries(
    entries(HARDWARE).map(([g, values]) => [
      g,
      Object.fromEntries(
        entries(values).map(([key, v]) => {
          const got = k[g]?.[key];
          return [key, typeof got === 'number' ? got : v];
        }),
      ),
    ]),
  ) as Hardware;
}
