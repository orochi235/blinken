import { f } from '@weasel-js/labkit';
import { stereo } from '@weasel-js/ui/components/MotifFrame';
import { FADE, type NumberParam, SIZE } from '@/index.js';
import { numberField, schemaFor, shownValues, storedValue } from './schema.js';

const share = (label: string, about: string): NumberParam => ({
  label,
  min: 0,
  max: 0.2,
  step: 0.001,
  value: 0,
  unit: '%',
  scale: 100,
  about,
});
const leak = (label: string, about: string): NumberParam => ({
  label,
  about,
  min: 0,
  max: 0.3,
  step: 0.005,
  value: 0,
  unit: '%',
  scale: 100,
});

/** Each group of the sign's hardware settings. */
const GROUPS = {
  size: {
    cols: {
      label: 'columns',
      min: 10,
      max: 240,
      step: 1,
      value: SIZE.cols,
      unit: 'dots',
      about:
        'How many dots across the sign is. A message wider than the sign clips, except in moves that scroll it.',
    },
    rows: {
      label: 'rows',
      min: 5,
      max: 40,
      step: 1,
      value: SIZE.rows,
      unit: 'dots',
      about:
        'How many dots down the sign is. Every 8 rows fit another line of the same message; below 7 the message shows its top.',
    },
  },
  fade: {
    rise: {
      label: 'rise',
      min: 0,
      max: 200,
      step: 1,
      value: FADE.rise,
      unit: 'ms',
      about:
        'How long a light takes to come on fully. At 0 it snaps on like an LED; higher warms up like a bulb.',
    },
    fall: {
      label: 'fall',
      min: 0,
      max: 1000,
      step: 5,
      value: FADE.fall,
      unit: 'ms',
      about:
        'How long a light takes to go dark. At 0 it snaps off; higher leaves a fading afterglow behind moving text.',
    },
  },
  ghost: {
    row: leak(
      'row',
      'How much an unlit dot glows from the lit dots in its row, as old signs leak current along their wiring. Higher draws faint streaks across the sign.',
    ),
    col: leak(
      'column',
      'How much an unlit dot glows from the lit dots in its column, as old signs leak current along their wiring. Higher draws faint streaks up and down.',
    ),
  },
  defects: {
    dead: share('dead', 'What share of the dots are burned out and never light.'),
    dim: share('dim', 'What share of the dots light at only about a third of their brightness.'),
    flicker: share('flicker', 'What share of the dots drop out at random moments.'),
    stuck: share('stuck on', 'What share of the dots stay lit whatever the message shows.'),
    seed: {
      label: 'seed',
      min: 1,
      max: 50,
      step: 1,
      value: 1,
      about:
        'Which dots get the faults. Each number picks a different set; the same number always picks the same one.',
    },
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
          .motif(stereo({ invert: true })),
      ]),
    ),
  );

/** Hardware read back from storage, each value kept only when it is a number, held to its range. */
export function hardwareOf(kept: unknown): Hardware {
  const k = (kept ?? {}) as Record<string, Record<string, unknown>>;
  return Object.fromEntries(
    entries(GROUPS).map(([g, params]) => [
      g,
      Object.fromEntries(
        entries(params).map(([key, param]) => {
          const p = param as NumberParam;
          const got = k[g]?.[key];
          return [key, typeof got === 'number' ? Math.min(p.max, Math.max(p.min, got)) : p.value];
        }),
      ),
    ]),
  ) as Hardware;
}

/** Hardware as the panel's controls show it, each scaled number multiplied up. */
export const shownHardware = (h: Hardware) =>
  Object.fromEntries(entries(GROUPS).map(([g, params]) => [g, shownValues(params, h[g])]));

/** A value the panel's control at `group.key` wrote, as the hardware stores it. */
export function storedHardware(path: string, v: unknown): unknown {
  const [g, key] = path.split('.') as [Group, string];
  return storedValue(GROUPS[g] ?? {}, key, v);
}
