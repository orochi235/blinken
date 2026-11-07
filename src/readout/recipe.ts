import type { CellFrame, CellShown, Change, Transition } from './transitions.js';
import type { Spelling } from './type.js';

/** What each cell does over its turn. */
export type TransitionMove = 'cut' | 'fade' | 'step' | 'scramble' | 'count';
/** Which cells turn first. */
export type TransitionOrder = 'left' | 'right' | 'center' | 'edges' | 'random';
/** How a cell's turn speeds up and slows down. */
export type TransitionEasing = 'linear' | 'in' | 'out' | 'in-out';

/** A transition described by its settings, for `createTransition`. */
export interface TransitionRecipe {
  readonly name: string;
  /** How long it runs unless `transitionMs` says otherwise, ms. */
  readonly ms: number;
  /**
   * What each cell does over its turn: `cut` changes at its start, `fade` dims the old lights as the
   * new brighten, `step` passes through `through`'s characters between, `scramble` flickers through
   * `rolls` random characters, and `count` shows the numbers between, the whole value at once. A
   * type that can't spell fades in place of `step` and `scramble`, and `count` fades anything that
   * isn't a number.
   */
  readonly move: TransitionMove;
  /** Which cells turn first. Default `left`, left to right. */
  readonly order?: TransitionOrder;
  /** How much of the run separates the first cell's turn starting from the last's, 0 to 1. Default 0. */
  readonly spread?: number;
  /** Default `linear`. */
  readonly easing?: TransitionEasing;
  /** The characters `step` passes through, in order and wrapping. Default `STEP_SEQUENCE`. */
  readonly through?: string;
  /** How many characters `scramble` shows in each cell's turn. Default 10. */
  readonly rolls?: number;
}

/** A transition `createTransition` made, carrying the recipe it was made from. */
export interface RecipeTransition extends Transition {
  readonly recipe: TransitionRecipe;
}

/** What `step` passes through unless a recipe says otherwise: a blank, letters, digits, then `-.:/`. */
export const STEP_SEQUENCE = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.:/';

const EASINGS: Record<TransitionEasing, (u: number) => number> = {
  linear: (u) => u,
  in: (u) => u ** 3,
  out: (u) => 1 - (1 - u) ** 3,
  'in-out': (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
};

const lit =
  (set: ReadonlySet<string>): CellFrame =>
  (light) =>
    set.has(light) ? 1 : 0;
const blank: CellShown = { lit: new Set(), text: '' };
const clamp = (u: number) => Math.min(1, Math.max(0, u));

/** Where each of `n` cells comes in `order`, from 0 (first) to 1 (last). */
function ranks(order: TransitionOrder, n: number, random: () => number): number[] {
  if (n <= 1) return Array.from({ length: n }, () => 0);
  const half = (n - 1) / 2;
  const at = (k: number) => {
    const across = k / (n - 1);
    const out = Math.abs(k - half) / half;
    return order === 'right'
      ? 1 - across
      : order === 'center'
        ? out
        : order === 'edges'
          ? 1 - out
          : across;
  };
  if (order !== 'random') return Array.from({ length: n }, (_, k) => at(k));
  const shuffled = Array.from({ length: n }, (_, k) => k);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as number, shuffled[i] as number];
  }
  const rank: number[] = [];
  shuffled.forEach((k, i) => {
    rank[k] = i / (n - 1);
  });
  return rank;
}

/** `seq`'s characters that `spell` lights something for, keeping a blank. */
const alphabet = (spell: Spelling, seq: string) =>
  [...seq].filter((ch) => ch === ' ' || spell.lights(ch).size > 0);
/** A cell's character for stepping: its first, uppercased where the sequence has no lowercase, or a blank. */
const charOf = (s: CellShown, chars: readonly string[]) => {
  const ch = [...s.text][0] ?? ' ';
  return chars.includes(ch) ? ch : ch.toUpperCase();
};

/** What a cell shows part way through its turn, `u` from 0 to 1, already eased. */
type CellMove = (k: number, u: number) => CellFrame;

function fadeMove(c: Change): CellMove {
  return (k, u) => {
    const a = (c.from[k] ?? blank).lit;
    const b = (c.to[k] ?? blank).lit;
    return (light) =>
      a.has(light) && b.has(light) ? 1 : a.has(light) ? 1 - u : b.has(light) ? u : 0;
  };
}

function stepMove(c: Change, spell: Spelling, seq: string): CellMove {
  const chars = alphabet(spell, seq);
  const fade = fadeMove(c);
  const paths = Array.from({ length: Math.max(c.from.length, c.to.length) }, (_, k) => {
    const a = chars.indexOf(charOf(c.from[k] ?? blank, chars));
    const b = chars.indexOf(charOf(c.to[k] ?? blank, chars));
    if (a < 0 || b < 0) return null;
    const steps = (b - a + chars.length) % chars.length;
    return Array.from({ length: steps }, (_, s) =>
      spell.lights(chars[(a + s + 1) % chars.length] as string),
    );
  });
  return (k, u) => {
    const path = paths[k];
    if (!path) return fade(k, u);
    if (u >= 1 || path.length === 0) return lit((c.to[k] ?? blank).lit);
    return lit(path[Math.min(path.length - 1, Math.floor(u * path.length))] as ReadonlySet<string>);
  };
}

function scrambleMove(c: Change, spell: Spelling, rolls: number): CellMove {
  const chars = alphabet(spell, STEP_SEQUENCE).filter((ch) => ch !== ' ');
  const n = Math.max(c.from.length, c.to.length);
  const rolled = Array.from({ length: n }, () =>
    Array.from({ length: rolls }, () =>
      spell.lights(chars[Math.floor(c.random() * chars.length)] ?? ' '),
    ),
  );
  return (k, u) => {
    const to = c.to[k] ?? blank;
    if (u >= 1 || (to.text === '' && (c.from[k] ?? blank).text === '')) return lit(to.lit);
    return lit(rolled[k]?.[Math.floor(u * rolls)] ?? to.lit);
  };
}

/** The value `count` shows at `e` of the way from `a` to `b`, padded as `b` is written. */
function counting(c: Change): ((e: number) => readonly CellShown[]) | null {
  const a = Number(c.fromValue);
  const b = Number(c.toValue);
  if (String(c.fromValue).trim() === '' || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  const s = String(c.toValue);
  const places = s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
  const width = s.replace(/^-/, '').length;
  const pad = /^-?0\d/.test(s);
  return (e) => {
    const v = (a + (b - a) * e).toFixed(places);
    return c.shownOf(pad ? v.replace(/^(-?)(.*)$/, (_, m, d) => m + d.padStart(width, '0')) : v);
  };
}

/**
 * A transition from its settings. Each cell takes its turn in `order`, the turns starting `spread`
 * of the run apart, and does its `move` over its turn, eased by `easing`. The result carries its
 * `recipe`, so every built-in in `TRANSITIONS` can be read back as one and changed.
 */
export function createTransition(recipe: TransitionRecipe): RecipeTransition {
  const order = recipe.order ?? 'left';
  const spread = clamp(recipe.spread ?? 0);
  const ease = EASINGS[recipe.easing ?? 'linear'];
  const rolls = Math.max(1, Math.round(recipe.rolls ?? 10));
  return {
    name: recipe.name,
    ms: recipe.ms,
    recipe,
    start(c) {
      const n = Math.max(c.from.length, c.to.length);
      const final = () => c.to.map((s) => lit(s.lit));
      if (recipe.move === 'count') {
        const between = counting(c);
        if (between)
          return (t) => (t >= 1 ? final() : between(ease(clamp(t))).map((s) => lit(s.lit)));
      }
      const spell = c.spell;
      const move: CellMove | null =
        recipe.move === 'cut'
          ? null
          : recipe.move === 'step' && spell
            ? stepMove(c, spell, recipe.through ?? STEP_SEQUENCE)
            : recipe.move === 'scramble' && spell
              ? scrambleMove(c, spell, rolls)
              : fadeMove(c);
      const rank = ranks(order, n, c.random);
      return (t) => {
        if (t >= 1) return final();
        return Array.from({ length: n }, (_, k) => {
          const at = (rank[k] ?? 0) * spread;
          // A whole spread leaves each cell no time of its own: it changes as its turn comes.
          const u = spread >= 1 ? (t >= at && t > 0 ? 1 : 0) : clamp((t - at) / (1 - spread));
          if (u <= 0) return lit((c.from[k] ?? blank).lit);
          if (!move) return lit((c.to[k] ?? blank).lit);
          return move(k, ease(u));
        });
      };
    },
  };
}
