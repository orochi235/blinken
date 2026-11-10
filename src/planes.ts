import type { Pose } from './board.js';

/** A channel of the sign's kit. */
export type Channel = keyof Pose;

/** The four things an effect can vary on a dot, each owning its own channels. */
export type Plane = 'shape' | 'brightness' | 'color' | 'glow';

/** Which channels each plane drives. */
export const PLANES: Readonly<Record<Plane, readonly Channel[]>> = {
  shape: ['lit', 'invert'],
  brightness: ['gain'],
  color: ['tint', 'hue', 'chroma'],
  glow: ['glow'],
};

/** The plane a channel is on. */
export function planeOf(c: Channel): Plane {
  for (const plane of Object.keys(PLANES) as Plane[]) {
    if ((PLANES[plane] as readonly Channel[]).includes(c)) return plane;
  }
  throw new Error(`channel ${c} is on no plane`);
}

/**
 * Channels that mix alike, each group the channels one of its members' curves could drive instead:
 * `mul` channels together, `max` channels together, and the rest alone.
 */
export const ALIKE: readonly (readonly Channel[])[] = [
  ['gain', 'chroma', 'glow'],
  ['lit', 'invert'],
  ['hue'],
  ['tint'],
];

/** The channels that mix as `c` does, `c` among them. */
export const alikeOf = (c: Channel): readonly Channel[] => ALIKE.find((g) => g.includes(c)) ?? [c];
