import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { ADVANCE, type Bitmap, FACE, ROWS, rasterize } from '../font.js';
import { hash } from '../hash.js';
import { litAt, move, on, rowOf } from './move.js';

/** A reel's pitch: a glyph and the blank row under it. */
const REEL = ROWS + 1;
const glyphs = new Map<string, Bitmap>();
const glyph = (ch: string) => {
  let g = glyphs.get(ch);
  if (g === undefined) {
    g = rasterize(ch);
    glyphs.set(ch, g);
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
    ms: { label: 'spin', min: 200, max: 3000, step: 50, value: 900, unit: 'ms' },
    glyphs: { label: 'glyphs passed', min: 1, max: 30, step: 1, value: 6 },
  },
  length: (_, p) => p.ms,
  patch(at, p) {
    const { text } = at;
    const n = text.cols / ADVANCE;
    const reels = Array.from({ length: n }, (_, k) =>
      Array.from({ length: p.glyphs }, (_, j) =>
        glyph(FACE[Math.floor(hash(k, j, text.cols) * FACE.length)] as string),
      ),
    );
    return patch<Led, Pose>(
      p.ms,
      (phase, led) => {
        const row = rowOf(led);
        const x = led.x - at.left;
        const k = Math.floor(x / ADVANCE);
        if (row < 0 || k < 0 || k >= n) return on(false);
        const reel = reels[k] as Bitmap[];
        const r = row + Math.floor(REEL * reel.length * easeOut(phase));
        const j = Math.floor(r / REEL);
        const y = r % REEL;
        const yes =
          y < ROWS &&
          (j < reel.length ? (reel[j] as Bitmap).lit(x - k * ADVANCE, y) : text.lit(x, y));
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
  params: { ms: { label: 'roll time', min: 100, max: 3000, step: 50, value: 500, unit: 'ms' } },
  length: (_, p) => p.ms,
  patch: (at, p) =>
    patch<Led, Pose>(
      p.ms,
      (phase, led) => on(litAt(at, led, 0, -Math.floor(REEL * 2 * phase ** 2))),
      {
        writes: ['lit'],
      },
    ),
});
