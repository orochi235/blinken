import { FADE, type Marquee, type NumberParam, scatter } from '@/index.js';
import { h, numberControl } from './controls.js';

/** The browser-storage key the sign's hardware is kept under, apart from the draft: it belongs to the sign, not the composition. */
const KEY = 'bree-compose-sign';

const share = (label: string): NumberParam => ({ label, min: 0, max: 0.2, step: 0.005, value: 0 });
const leak = (label: string): NumberParam => ({ label, min: 0, max: 0.3, step: 0.005, value: 0 });

/** Each group of settings, as a card of sliders. */
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
type Settings = { [G in Group]: Record<keyof (typeof GROUPS)[G], number> };

const read = (): Settings => {
  let kept: Record<string, Record<string, unknown>> = {};
  try {
    kept = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {}
  const out = {} as Record<string, Record<string, number>>;
  for (const [g, params] of Object.entries(GROUPS)) {
    out[g] = {};
    for (const [k, p] of Object.entries(params as Record<string, NumberParam>)) {
      const v = kept[g]?.[k];
      (out[g] as Record<string, number>)[k] = typeof v === 'number' ? v : p.value;
    }
  }
  return out as Settings;
};

/** The sign's hardware: how its lights fade, how much they ghost, and which are broken. */
export function mountSign(root: HTMLElement, sign: Marquee): void {
  const now = read();
  const apply = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(now));
    } catch {}
    sign.setFade(now.fade);
    sign.setGhost(now.ghost);
    sign.setDefects(scatter(sign.board, now.defects, now.defects.seed));
  };
  const card = (g: Group) => {
    const values = now[g] as Record<string, number>;
    const controls = Object.entries(GROUPS[g] as Record<string, NumberParam>).map(([k, p]) =>
      numberControl(p, values[k] ?? p.value, (v) => {
        values[k] = v;
        apply();
      }),
    );
    return h('div', 'layer', h('strong', undefined, g), ...controls);
  };
  root.replaceChildren(
    h('header', 'pane-head', h('h2', undefined, 'sign')),
    ...(Object.keys(GROUPS) as Group[]).map(card),
  );
  apply();
}
