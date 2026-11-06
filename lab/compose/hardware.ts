import { f, usePersistedState } from '@weasel-js/labkit';
import { stereo } from '@weasel-js/ui/components/MotifFrame';
import { useMemo } from 'react';
import type { ChoiceParam, NumberParam } from '@/index.js';
import { marqueeSlider } from './MarqueeSlider.js';
import { fieldOf, schemaFor, shownValues, storedValue } from './schema.js';
import {
  entries,
  GROUPS,
  type Group,
  HARDWARE,
  type Hardware,
  hardwareOf,
} from './sign-hardware.js';

export { HARDWARE, type Hardware, hardwareOf };

const readoutKey = (g: string, k: string) => `readout:${g}.${k}`;

/** The groups whose rows draw their number on a small sign: the sign's own size, read in dots. */
const ON_A_SIGN: readonly Group[] = ['size'];

/** The hardware panel's rows that draw their number on a small sign. */
export const HARDWARE_RENDERERS = Object.fromEntries(
  ON_A_SIGN.flatMap((g) =>
    entries(GROUPS[g]).map(([k, p]) => [readoutKey(g, k), marqueeSlider(p as NumberParam)]),
  ),
);

/** The hardware panel's schema: a group per card, so a value sits at `fade.rise`. */
export const hardwareSchema = () =>
  schemaFor('hardware', () =>
    Object.fromEntries(
      entries(GROUPS).map(([g, params]) => [
        g,
        f
          .group(
            Object.fromEntries(
              entries(params).map(([k, param]) => {
                const p = param as NumberParam | ChoiceParam;
                if ('choices' in p || !ON_A_SIGN.includes(g)) return [k, fieldOf(p)];
                const shown = p.value * (p.scale ?? 1);
                return [k, f.custom(readoutKey(g, k), shown).label(p.label).describe(p.about)];
              }),
            ),
          )
          .label(g)
          .motif(stereo()),
      ]),
    ),
  );

/** The lab records the sign's hardware is kept in, under compose's name, which every page opens. */
export const SIGN_RECORDS = 'blinken-compose';

/**
 * The sign's hardware, shared by every page under a `<Persistence>` of `SIGN_RECORDS`, and a
 * change to it. It belongs to the sign, not the composition, so it stays out of drafts and links.
 */
export function useHardware(): [Hardware, (fn: (h: Hardware) => Hardware) => void] {
  const [kept, setKept] = usePersistedState<Hardware>('sign', HARDWARE, { scope: 'lab' });
  const hardware = useMemo(() => hardwareOf(kept), [kept]);
  return [hardware, (fn) => setKept((h) => fn(hardwareOf(h)))];
}

/** Hardware as the panel's controls show it, each scaled number multiplied up. */
export const shownHardware = (h: Hardware) =>
  Object.fromEntries(entries(GROUPS).map(([g, params]) => [g, shownValues(params, h[g])]));

/** A value the panel's control at `group.key` wrote, as the hardware stores it. */
export function storedHardware(path: string, v: unknown): unknown {
  const [g, key] = path.split('.') as [Group, string];
  return storedValue(GROUPS[g] ?? {}, key, v);
}
