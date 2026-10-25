import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import type { Placed } from '../orders.js';
import type { Values } from '../params.js';
import { move, on } from './move.js';

/** How long the cursor stays on, or off, as it blinks. */
const BLINK = 220;

const TYPE_PARAMS = {
  ms: {
    label: 'letter time',
    min: 30,
    max: 600,
    step: 10,
    value: 110,
    unit: 'ms',
    about: 'How long each letter takes to type. Higher types more slowly.',
  },
  cursor: {
    label: 'cursor',
    choices: ['block', 'line', 'off'],
    value: 'block',
    about:
      'What stands where the next letter lands: a block as wide as the letter, a single column, or nothing.',
  },
} as const;
type Typing = Values<typeof TYPE_PARAMS>;

/**
 * The message typed out a letter at a time, `t` ms in: a lit cursor standing where the next letter
 * lands and, once the last is down, blinking twice before it goes.
 */
function typing(at: Placed, p: Typing) {
  const { text } = at;
  const n = text.letters.length;
  const cursor = p.cursor !== 'off';
  const ms = Math.max(1, n * p.ms + (cursor ? 4 * BLINK : 0));
  const last = text.letters[n - 1];
  const widths = text.letters.map((s) => s.width - 1).sort((a, b) => a - b);
  const typical = Math.max(1, widths[Math.floor(widths.length / 2)] ?? 3);
  /** The columns the cursor covers standing before letter `k`. */
  const slot = (k: number) => {
    const s = text.letters[k];
    const x = s ? s.x : last ? last.x + last.width : 0;
    const width = p.cursor === 'line' ? 1 : s ? Math.max(1, s.width - 1) : typical;
    return { x, width };
  };
  const top = text.above;
  const bottom = text.rows - 1 - text.below;
  /** The letter a dot of the text belongs to, the nearest where it lies outside every span. */
  const ownerOf = (x: number, row: number) => {
    const k = text.letterAt(x, row);
    return k >= 0 ? k : x < (text.letters[0]?.x ?? 0) ? 0 : n - 1;
  };
  return {
    ms,
    draw(t: number, led: Led) {
      const row = at.rowOf(led);
      if (row < 0) return on(false);
      const x = led.x - at.left;
      const typed = Math.min(n, Math.floor(t / p.ms));
      const level = text.level(x, row);
      if (level > 0 && ownerOf(x, row) < typed) return on(level);
      if (!cursor || row < top || row > bottom || t < p.ms / 2) return on(false);
      // Solid while typing, then on, off, on, off.
      const after = t - n * p.ms;
      if (after >= 0 && Math.floor(after / BLINK) % 2 === 1) return on(false);
      if (after >= 4 * BLINK) return on(false);
      const s = slot(typed);
      return on(x >= s.x && x < s.x + s.width);
    },
  };
}

/** Letters typed on one at a time behind a cursor. */
export const typeOn = move({
  name: 'type-on',
  about: 'Letters appear one at a time left to right behind a cursor, which blinks and goes.',
  slot: 'enter',
  params: TYPE_PARAMS,
  patch(at, p) {
    const { ms, draw } = typing(at, p);
    return patch<Led, Pose>(ms, (phase, led) => draw(phase * ms, led), { writes: ['lit'] });
  },
});

/** Letters backspaced off right to left, the cursor blinking first. */
export const typeOff = move({
  name: 'type-off',
  about: 'A cursor blinks after the message, then backspaces it away right to left.',
  slot: 'exit',
  params: TYPE_PARAMS,
  patch(at, p) {
    const { ms, draw } = typing(at, p);
    return patch<Led, Pose>(ms, (phase, led) => draw((1 - phase) * ms, led), { writes: ['lit'] });
  },
});
