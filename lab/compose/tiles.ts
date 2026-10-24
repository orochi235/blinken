import { EFFECTS } from '@/index.js';
import type { Library } from './library.js';

/** What a built-in's preview looks its name up in, so an effect of yours by the same name doesn't shadow it. */
const BUILT_IN: Library = {};

/** One effect a list of them shows: where its preview looks it up, and whether it is a built-in. */
export interface EffectTile {
  key: string;
  name: string;
  effects: Library;
  builtin: boolean;
  about?: string;
}

/** Every effect a list shows: `own` first, then each built-in `own` doesn't hold a namesake of. */
export const tilesOf = (own: Library): EffectTile[] => [
  ...Object.entries(own).map(([name, spec]) => ({
    key: `y:${name}`,
    name,
    effects: own,
    builtin: false,
    about: spec.about,
  })),
  ...Object.entries(EFFECTS)
    .filter(([name]) => !Object.hasOwn(own, name))
    .map(([name, spec]) => ({
      key: `b:${name}`,
      name,
      effects: BUILT_IN,
      builtin: true,
      about: spec.about,
    })),
];
