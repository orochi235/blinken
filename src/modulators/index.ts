import { chase } from './chase.js';
import { palette, twoColor } from './color.js';
import { desaturate, dim, flare } from './ease.js';
import type { Modulator } from './modulator.js';
import { sparkle } from './sparkle.js';
import { bloom, flash, hueCycle, pulse } from './wave.js';

export * from './modulator.js';
export { bloom, chase, desaturate, dim, flare, flash, hueCycle, palette, pulse, sparkle, twoColor };

const modulators = {
  flash,
  pulse,
  dim,
  'hue-cycle': hueCycle,
  palette,
  'two-color': twoColor,
  desaturate,
  bloom,
  flare,
  sparkle,
  chase,
};
export type ModulatorName = keyof typeof modulators;
/** Every modulator, by name. */
export const MODULATORS: Readonly<Record<ModulatorName, Modulator>> = modulators;
