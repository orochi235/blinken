import type { DisplayType, TypeName } from '../type.js';
import { fourteen, sixteen, twentytwo } from './alpha.js';
import { bargraph, bcd, dice, tally } from './counts.js';
import { dl2416 } from './dl2416.js';
import { dl3422 } from './dl3422.js';
import { matrix } from './matrix.js';
import { nixie } from './nixie.js';
import { cistercian, kaktovik, maya, rods } from './numerals.js';
import { dl3416, hdsp211x, hdsp2000 } from './parts-matrix.js';
import { dl34, dl330m, hp50827415 } from './parts-numeric.js';
import { braille, morse, ogham, semaphore } from './scripts.js';
import { eight, half, nine, seven } from './segments.js';
import { triangles, trianglesFine } from './triangles.js';

/** Every display type, by name. */
export const TYPES: Readonly<Record<TypeName, DisplayType>> = {
  seven,
  eight,
  nine,
  half,
  fourteen,
  sixteen,
  twentytwo,
  nixie,
  cistercian,
  matrix,
  maya,
  kaktovik,
  rods,
  braille,
  ogham,
  morse,
  semaphore,
  dice,
  tally,
  bcd,
  bargraph,
  triangles,
  'triangles-fine': trianglesFine,
  dl3422,
  dl2416,
  dl3416,
  hdsp2000,
  hdsp211x,
  dl330m,
  hp50827415,
  dl34,
};
