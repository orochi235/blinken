import { createTransition, type RecipeTransition, STEP_SEQUENCE } from './recipe.js';
import type { Spelling } from './type.js';

/** What one cell shows: its lit lights, and the character it spells there, if any. */
export interface CellShown {
  readonly lit: ReadonlySet<string>;
  readonly text: string;
}

/** A readout's change from one value to another, as a transition sees it. */
export interface Change {
  readonly from: readonly CellShown[];
  readonly to: readonly CellShown[];
  readonly fromValue: string | number;
  readonly toValue: string | number;
  /** How its type spells, where it does: a character's lit lights. */
  readonly spell?: Spelling;
  /** Every cell as some other value would show it, for one passing through values between. */
  shownOf(value: string | number): readonly CellShown[];
  /** A number from 0 to 1, the same sequence for the same change. */
  random(): number;
}

/** How brightly each light of a cell shows, 0 to 1, by name. */
export type CellFrame = (light: string) => number;

/** How a readout moves from one value to the next, given to `transition`. */
export interface Transition {
  readonly name: string;
  /** How long it runs unless `transitionMs` says otherwise, ms. */
  readonly ms: number;
  /** Each cell's frame at a time from 0 (the old value) to 1 (the new). */
  start(change: Change): (t: number) => readonly CellFrame[];
}

/** The built-in transitions, by name, each made by `createTransition` and carrying its recipe. */
export const TRANSITIONS = {
  /** The new value at once. */
  cut: createTransition({ name: 'cut', ms: 0, move: 'cut' }),
  /** Old lights dim as new ones brighten; a light lit in both stays lit. */
  fade: createTransition({ name: 'fade', ms: 400, move: 'fade' }),
  /** Each cell flickers through random characters, then lands, left to right. */
  scramble: createTransition({
    name: 'scramble',
    ms: 700,
    move: 'scramble',
    spread: 0.6,
    rolls: 8,
  }),
  /** A number counts through the values between, eased; anything else fades. */
  count: createTransition({ name: 'count', ms: 800, move: 'count', easing: 'out' }),
  /** Cells change to the new value one after another, left to right. */
  wipe: createTransition({ name: 'wipe', ms: 450, move: 'cut', spread: 1 }),
  /** Each cell steps through the alphabet to its new character, as a split-flap board's cards do. */
  flap: createTransition({
    name: 'flap',
    ms: 1400,
    move: 'step',
    spread: 0.3,
    through: STEP_SEQUENCE,
  }),
  /** Each digit rolls up through the digits to its new one, as an odometer's wheels do. */
  roll: createTransition({ name: 'roll', ms: 900, move: 'step', through: '0123456789' }),
} as const satisfies Record<string, RecipeTransition>;

export type TransitionName = keyof typeof TRANSITIONS;

/** The transition a readout's option names or gives. */
export const transitionOf = (t: TransitionName | Transition | undefined): Transition =>
  t === undefined ? TRANSITIONS.cut : typeof t === 'string' ? TRANSITIONS[t] : t;
