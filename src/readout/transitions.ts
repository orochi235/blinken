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

const lit =
  (set: ReadonlySet<string>): CellFrame =>
  (light) =>
    set.has(light) ? 1 : 0;
const blank: CellShown = { lit: new Set(), text: '' };
const cellsOf = (c: Change) => Math.max(c.from.length, c.to.length);
/** When cell `k` of `n` turns, from 0 to `spread`, left to right. */
const turnAt = (k: number, n: number, spread: number) => (n <= 1 ? 0 : (k / (n - 1)) * spread);

/** Old lights dim as new ones brighten; a light lit in both stays lit. */
const fade: Transition = {
  name: 'fade',
  ms: 400,
  start(c) {
    const n = cellsOf(c);
    return (t) =>
      Array.from({ length: n }, (_, k) => {
        const a = (c.from[k] ?? blank).lit;
        const b = (c.to[k] ?? blank).lit;
        return (light) =>
          a.has(light) && b.has(light) ? 1 : a.has(light) ? 1 - t : b.has(light) ? t : 0;
      });
  },
};

/** The characters a flap or reel steps through, in order; a type keeps the ones it can show. */
const SEQUENCE = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.:/';
const DIGITS = '0123456789';

/** `seq`'s characters that `spell` lights something for, a blank first. */
function alphabet(spell: Spelling, seq: string): string[] {
  return [...seq].filter((ch) => ch === ' ' || spell.lights(ch).size > 0);
}

/** A cell's character for stepping: its first, or a blank. */
const charOf = (s: CellShown) => [...s.text][0]?.toUpperCase() ?? ' ';

/**
 * A transition stepping each cell through `seq` from its old character to its new, forward and
 * wrapping, each cell starting a little after the one before. A cell `seq` can't step through
 * fades instead.
 */
function stepping(name: string, ms: number, seq: string, spread: number): Transition {
  return {
    name,
    ms,
    start(c) {
      const spell = c.spell;
      if (!spell) return fade.start(c);
      const chars = alphabet(spell, seq);
      const n = cellsOf(c);
      const paths = Array.from({ length: n }, (_, k) => {
        const a = chars.indexOf(charOf(c.from[k] ?? blank));
        const b = chars.indexOf(charOf(c.to[k] ?? blank));
        if (a < 0 || b < 0) return null;
        const steps = (b - a + chars.length) % chars.length;
        return Array.from({ length: steps }, (_, s) =>
          spell.lights(chars[(a + s + 1) % chars.length] as string),
        );
      });
      const fallback = fade.start(c);
      return (t) => {
        const faded = fallback(t);
        return Array.from({ length: n }, (_, k) => {
          const to = c.to[k] ?? blank;
          const path = paths[k];
          if (!path) return faded[k] ?? lit(to.lit);
          const at = turnAt(k, n, spread);
          const u = Math.min(1, Math.max(0, (t - at) / (1 - spread)));
          if (u >= 1 || path.length === 0) return lit(to.lit);
          if (u <= 0) return lit((c.from[k] ?? blank).lit);
          return lit(
            path[Math.min(path.length - 1, Math.floor(u * path.length))] as ReadonlySet<string>,
          );
        });
      };
    },
  };
}

/** The built-in transitions, by name. */
export const TRANSITIONS = {
  /** The new value at once. */
  cut: {
    name: 'cut',
    ms: 0,
    start: (c) => () => c.to.map((s) => lit(s.lit)),
  },
  fade,
  /** Each cell flickers through random characters, then lands, left to right. */
  scramble: {
    name: 'scramble',
    ms: 700,
    start(c) {
      const spell = c.spell;
      if (!spell) return fade.start(c);
      const chars = alphabet(spell, SEQUENCE).filter((ch) => ch !== ' ');
      const n = cellsOf(c);
      const rolls = Array.from({ length: 24 }, () =>
        Array.from({ length: n }, () =>
          spell.lights(chars[Math.floor(c.random() * chars.length)] ?? ' '),
        ),
      );
      return (t) =>
        Array.from({ length: n }, (_, k) => {
          const to = c.to[k] ?? blank;
          if (t <= 0) return lit((c.from[k] ?? blank).lit);
          if (t >= 0.35 + turnAt(k, n, 0.6) || (to.text === '' && (c.from[k] ?? blank).text === ''))
            return lit(to.lit);
          return lit(rolls[Math.floor(t * 24) % 24]?.[k] ?? to.lit);
        });
    },
  },
  /** A number counts through the values between, eased; anything else fades. */
  count: {
    name: 'count',
    ms: 800,
    start(c) {
      const a = Number(c.fromValue);
      const b = Number(c.toValue);
      const s = String(c.toValue);
      if (String(c.fromValue).trim() === '' || !Number.isFinite(a) || !Number.isFinite(b))
        return fade.start(c);
      const places = s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
      const width = s.replace(/^-/, '').length;
      const pad = /^-?0\d/.test(s);
      return (t) => {
        if (t >= 1) return c.to.map((x) => lit(x.lit));
        const e = 1 - (1 - t) ** 3;
        const v = (a + (b - a) * e).toFixed(places);
        const shown = pad ? v.replace(/^(-?)(.*)$/, (_, m, d) => m + d.padStart(width, '0')) : v;
        return c.shownOf(shown).map((x) => lit(x.lit));
      };
    },
  },
  /** Cells change to the new value one after another, left to right. */
  wipe: {
    name: 'wipe',
    ms: 450,
    start(c) {
      const n = cellsOf(c);
      return (t) =>
        Array.from({ length: n }, (_, k) =>
          lit((t >= turnAt(k, n, 1) && t > 0 ? (c.to[k] ?? blank) : (c.from[k] ?? blank)).lit),
        );
    },
  },
  /** Each cell steps through the alphabet to its new character, as a split-flap board's cards do. */
  flap: stepping('flap', 1400, SEQUENCE, 0.3),
  /** Each digit rolls up through the digits to its new one, as an odometer's wheels do. */
  roll: stepping('roll', 900, DIGITS, 0),
} as const satisfies Record<string, Transition>;

export type TransitionName = keyof typeof TRANSITIONS;

/** The transition a readout's option names or gives. */
export const transitionOf = (t: TransitionName | Transition | undefined): Transition =>
  t === undefined ? TRANSITIONS.cut : typeof t === 'string' ? TRANSITIONS[t] : t;
