import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { type Bitmap, CHARS, rasterize } from '../font.js';
import { hash } from '../hash.js';
import { litAt, move, on } from './move.js';

const glyphs = new Map<string, Bitmap>();
/** One letter alone in the look of `text`, which draws it where `text` draws its letters. */
const glyph = (text: Bitmap, ch: string) => {
  const key = `${text.face.name} ${text.style.reverse ? 'r' : ''}${text.style.proportional ? 'p' : ''} ${ch}`;
  let g = glyphs.get(key);
  if (g === undefined) {
    g = rasterize(ch, text);
    glyphs.set(key, g);
  }
  return g;
};
const easeOut = (u: number) => 1 - (1 - u) ** 3;

/** Each letter a reel spinning through random glyphs and slowing onto its own. */
export const reelIn = move({
  name: 'reel-in',
  about: 'Each letter spins through random glyphs like a slot reel and lands on its own.',
  slot: 'enter',
  params: {
    ms: {
      label: 'spin',
      min: 200,
      max: 3000,
      step: 50,
      value: 900,
      unit: 'ms',
      about: 'How long each reel spins before it settles on its letter.',
    },
    glyphs: {
      label: 'glyphs passed',
      min: 1,
      max: 30,
      step: 1,
      value: 6,
      about: 'How many random characters roll past before the letter lands. Higher spins faster.',
    },
  },
  patch(at, p) {
    const { text } = at;
    const n = text.letters.length;
    // A reel's pitch: a glyph and the blank row under it.
    const pitch = text.rows + 1;
    const reels = Array.from({ length: n }, (_, k) =>
      Array.from({ length: p.glyphs }, (_, j) =>
        glyph(text, CHARS[Math.floor(hash(k, j, text.cols) * CHARS.length)] as string),
      ),
    );
    return patch<Led, Pose>(
      p.ms,
      (phase, led) => {
        const row = at.rowOf(led);
        const x = led.x - at.left;
        const k = text.letterAt(x);
        if (row < 0 || k < 0) return on(false);
        const reel = reels[k] as Bitmap[];
        // The reel starts on a blank cell, so a letter waiting out its delay shows nothing.
        const r = row - pitch + Math.floor(pitch * (reel.length + 1) * easeOut(phase));
        const j = Math.floor(r / pitch);
        const y = ((r % pitch) + pitch) % pitch;
        const u = x - (text.letters[k] as { x: number }).x;
        const yes =
          j >= 0 &&
          y < text.rows &&
          (j < reel.length ? (reel[j] as Bitmap).lit(u, y) : text.lit(x, y));
        return on(yes);
      },
      { writes: ['lit'] },
    );
  },
});

/** The message rolling up and out of the top. */
export const rollAway = move({
  name: 'roll-away',
  about: 'The message rolls up and away.',
  slot: 'exit',
  params: {
    ms: {
      label: 'roll time',
      min: 100,
      max: 3000,
      step: 50,
      value: 500,
      unit: 'ms',
      about: 'How long the message takes to roll off the top. Higher rolls more slowly.',
    },
  },
  patch: (at, p) =>
    patch<Led, Pose>(
      p.ms,
      (phase, led) => on(litAt(at, led, 0, -Math.floor((at.text.rows + 1) * 2 * phase ** 2))),
      { writes: ['lit'] },
    ),
});
