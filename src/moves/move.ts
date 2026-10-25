import type { Patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import type { Placed } from '../orders.js';
import type { Params, Values } from '../params.js';

/** Which third of an effect a move plays in. */
export type Slot = 'enter' | 'active' | 'exit';
/** The slots in the order they play. */
export const SLOTS: readonly Slot[] = ['enter', 'active', 'exit'];

/**
 * For an active move: whether the message stands where `stand` shows it as the move starts, an
 * enter move having left it there, and whether it must stand there as it ends, for an exit move.
 */
export interface Joins {
  readonly from: boolean;
  readonly to: boolean;
}

/** An active move with no enter or exit move beside it. */
export const LOOSE: Joins = { from: false, to: false };

/** One thing the message's dots do over a stretch of time, written for one slot of an effect. */
export interface Move<P extends Params = Params> {
  readonly kind: 'move';
  readonly name: string;
  readonly about: string;
  readonly slot: Slot;
  readonly params: P;
  /** Written for text wider than the board, so it never clips. Default false. */
  readonly wide?: boolean;
  /** Writes `lit` only; its duration is one pass, before any order's delay. */
  patch(at: Placed, p: Values<P>, joins?: Joins): Patch<Led, Pose>;
}

/** Declares a move, keeping its params' keys in the type `patch` sees. */
export const move = <P extends Params>(m: Omit<Move<P>, 'kind'>): Move<P> => ({
  kind: 'move',
  ...m,
});

/** Whether the message, shifted `dx` dots right of where it stands, lights this dot. */
export const litAt = (at: Placed, led: Led, dx = 0, dy = 0) => {
  const row = at.rowOf(led);
  return row >= 0 && at.text.lit(led.x - at.left - dx, row - dy);
};

/** `lit` as the 0 or 1 a dot is given. */
export const on = (yes: boolean) => ({ lit: yes ? 1 : 0 });
