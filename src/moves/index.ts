import { cutOff, cutOn, stand } from './cut.js';
import { dropIn, dropOut } from './drop.js';
import { fold, tumble, unfold } from './fold.js';
import type { Move } from './move.js';
import { reelIn, rollAway } from './reel.js';
import { scrollAcross, scrollIn, scrollOut } from './scroll.js';
import { tile } from './tile.js';

export * from './move.js';
export {
  cutOff,
  cutOn,
  dropIn,
  dropOut,
  fold,
  reelIn,
  rollAway,
  scrollAcross,
  scrollIn,
  scrollOut,
  stand,
  tile,
  tumble,
  unfold,
};

const moves = {
  'cut-on': cutOn,
  'cut-off': cutOff,
  stand,
  unfold,
  fold,
  tumble,
  'drop-in': dropIn,
  'drop-out': dropOut,
  'reel-in': reelIn,
  'roll-away': rollAway,
  'scroll-in': scrollIn,
  'scroll-out': scrollOut,
  'scroll-across': scrollAcross,
  tile,
};
export type MoveName = keyof typeof moves;
/** Every move, by name. */
export const MOVES: Readonly<Record<MoveName, Move>> = moves;
