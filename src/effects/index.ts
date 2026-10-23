import { chase } from './chase.js';
import type { Layer, TextEffect } from './effect.js';
import { fall } from './fall.js';
import { flip } from './flip.js';
import { hold } from './hold.js';
import { rainbow } from './rainbow.js';
import { roll } from './roll.js';
import { scroll } from './scroll.js';
import { sparkle } from './sparkle.js';
import { tile } from './tile.js';

export * from './effect.js';
export { chase, fall, flip, hold, rainbow, roll, scroll, sparkle, tile };

const text = { hold, scroll, flip, roll, fall, tile };
const layers = { sparkle, chase, rainbow };
export type TextName = keyof typeof text;
export type LayerName = keyof typeof layers;
/** Every text effect, by name. */
export const TEXT: Readonly<Record<TextName, TextEffect>> = text;
/** Every layer, by name. */
export const LAYERS: Readonly<Record<LayerName, Layer>> = layers;
