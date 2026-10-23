import { type Board, type Defect, type FaultKind, type NumberParam, scatter } from '@/index.js';
import { h, numberControl } from './controls.js';

/** The browser-storage key the sign's breakage is kept under, apart from the draft: it belongs to the sign, not the composition. */
const KEY = 'bree-compose-defects';

type Breakage = Record<FaultKind | 'seed', number>;

const share = (label: string): NumberParam => ({ label, min: 0, max: 0.2, step: 0.005, value: 0 });
const PARAMS: Record<keyof Breakage, NumberParam> = {
  dead: share('dead'),
  dim: share('dim'),
  flicker: share('flicker'),
  stuck: share('stuck on'),
  seed: { label: 'seed', min: 1, max: 50, step: 1, value: 1 },
};

const read = (): Breakage => {
  const fresh = Object.fromEntries(
    Object.entries(PARAMS).map(([k, p]) => [k, p.value]),
  ) as Breakage;
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    for (const k of Object.keys(PARAMS) as (keyof Breakage)[])
      if (typeof kept[k] === 'number') fresh[k] = kept[k];
  } catch {}
  return fresh;
};

/** The sign's broken lights: a share of its dots for each fault, scattered by a seed. */
export function mountDefects(
  root: HTMLElement,
  b: Board,
  onChange: (defects: readonly Defect[]) => void,
): void {
  const now = read();
  const apply = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(now));
    } catch {}
    onChange(scatter(b, now, now.seed));
  };
  const controls = (Object.entries(PARAMS) as [keyof Breakage, NumberParam][]).map(([k, p]) =>
    numberControl(p, now[k], (v) => {
      now[k] = v;
      apply();
    }),
  );
  root.replaceChildren(
    h('header', 'pane-head', h('h2', undefined, 'defects')),
    h('div', 'layer', ...controls),
  );
  apply();
}
