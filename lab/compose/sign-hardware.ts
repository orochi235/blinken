import {
  type Border,
  type ChoiceParam,
  FADE,
  fits,
  GRIDS,
  type Marquee,
  MODULATORS,
  type NumberParam,
  SIZE,
  scatter,
} from '@/index.js';

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
export const GROUPS = {
  size: {
    cols: {
      label: 'columns',
      min: 10,
      max: 240,
      step: 1,
      value: SIZE.cols,
      about:
        'How many dots across the sign is. A message wider than the sign clips, except in moves that scroll it.',
    },
    rows: {
      label: 'rows',
      min: 5,
      max: 40,
      step: 1,
      value: SIZE.rows,
      about:
        'How many dots down the sign is. Each line of the message takes its letters\u2019 height and a dot between, so a taller sign stacks more lines; one too short shows the top of the letters.',
    },
    grid: {
      label: 'grid',
      choices: Object.keys(GRIDS),
      value: 'square',
      about:
        'How the dots are set out: square rows and columns; a hex grid where each row sits half a dot left of the one above, which leans the text like italics; or triangles, hexagons each cut into six, two to a dot of the text. The strokes face draws a triangle to a dot instead, on 14 or more rows.',
    } satisfies ChoiceParam,
  },
  border: {
    bulbs: {
      label: 'bulbs',
      choices: ['none', 'unlit', 'lit', 'chase'],
      value: 'unlit',
      about:
        'The ring of bulbs round the sign: none at all, dark, all lit, or a theater chase stepping round it.',
    } satisfies ChoiceParam,
    beat: MODULATORS.chase.params.beat as NumberParam,
    dim: MODULATORS.chase.params.dim as NumberParam,
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
} satisfies Record<string, Record<string, NumberParam | ChoiceParam>>;

export type Group = keyof typeof GROUPS;
/** The sign's size, its border, how its lights fade, how much they ghost, and which are broken. */
export type Hardware = {
  [G in Group]: {
    [K in keyof (typeof GROUPS)[G]]: (typeof GROUPS)[G][K] extends ChoiceParam ? string : number;
  };
};

export const entries = <T extends object>(o: T) =>
  Object.entries(o) as [keyof T & string, T[keyof T]][];

export const HARDWARE: Hardware = Object.fromEntries(
  entries(GROUPS).map(([g, params]) => [
    g,
    Object.fromEntries(
      entries(params).map(([k, p]) => [k, (p as NumberParam | ChoiceParam).value]),
    ),
  ]),
) as Hardware;

/** Hardware read back from storage, each value kept only when it is one its setting can hold, a number held to its range. */
export function hardwareOf(kept: unknown): Hardware {
  const k = (kept ?? {}) as Record<string, Record<string, unknown>>;
  return Object.fromEntries(
    entries(GROUPS).map(([g, params]) => [
      g,
      Object.fromEntries(
        entries(params).map(([key, param]) => {
          const p = param as NumberParam | ChoiceParam;
          const got = k[g]?.[key];
          if (!fits(p, got)) return [key, p.value];
          return [key, 'min' in p ? Math.min(p.max, Math.max(p.min, got as number)) : got];
        }),
      ),
    ]),
  ) as Hardware;
}

/** How the hardware's border lights its bulbs; with none, nothing is asked of a sign with none. */
export const borderOf = ({ border }: Hardware): Border => ({
  bulbs: border.bulbs === 'none' ? 'unlit' : (border.bulbs as Border['bulbs']),
  beat: border.beat,
  dim: border.dim,
});

/** Gives a sign the hardware's lights, its defects scattered over that sign's own dots. */
export function equip(m: Marquee, hardware: Hardware): void {
  m.setBorder(borderOf(hardware));
  m.setFade(hardware.fade);
  m.setGhost(hardware.ghost);
  m.setDefects(scatter(m.board, hardware.defects, hardware.defects.seed));
}
