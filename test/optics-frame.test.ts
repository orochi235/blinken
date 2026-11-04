import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { cssOf, dotColor } from '@/color.js';
import { afflict, afflictions, type Defect } from '@/defects.js';
import { shownLit, signColumns } from '@/draw.js';
import { FADE, ghosts, settle } from '@/optics.js';
import { createOpticsFrame, lit } from '@/render/optics-frame.js';

const b = board(4, 2, false);
const leds = [...b.dots, ...b.bulbs];
const defects: Defect[] = [
  { kind: 'dead', at: { x: 1, y: 0 } },
  { kind: 'stuck', at: { x: 2, y: 0 }, level: 0.6 },
  { kind: 'dim', at: { x: 3, y: 1 }, gain: 0.5 },
];
const ghost = { row: 0.2 };
const FALLBACK = 0xff9a2e;

function columns() {
  const cols = signColumns(leds.length);
  cols.lit.set([1, 1, 0, 0.5, 0.02, 0.9, 0, 1]);
  cols.invert[5] = 0.5;
  cols.gain[0] = 0.4;
  cols.hue[6] = 40;
  cols.chroma[7] = 0.5;
  cols.tint.set([0.6, 0.1, 0.1, 1], 5 * 4);
  return cols;
}

describe('createOpticsFrame', () => {
  it('matches the 2D sign’s per-light math over several frames', () => {
    const cols = columns();
    const broken = afflictions(leds, defects);
    const shown = new Float64Array(leds.length);
    const leak = new Float64Array(leds.length);
    const frame = createOpticsFrame(b, leds);
    frame.setDefects(defects);
    frame.setGhost(ghost);
    const out = lit(leds.length);
    let clock = 0;
    for (const bright of [1, 0.6, 1.5]) {
      clock += 16;
      for (let i = 0; i < leds.length; i++) {
        const target = afflict(broken, i, shownLit(cols.lit[i] ?? 0, cols.invert[i] ?? 0), clock);
        shown[i] = settle(shown[i] ?? 0, target, 16, FADE);
      }
      ghosts(b, shown, ghost, leak);
      frame.step(cols, FALLBACK, 16, bright, out);
      for (let i = 0; i < leds.length; i++) {
        const now = (shown[i] ?? 0) + (leak[i] ?? 0) * (broken.scale[i] ?? 1);
        const want = now < 0.02 ? 0 : Math.min(now * Math.min(cols.gain[i] ?? 1, 1) * bright, 1);
        expect(out.shine[i]).toBeCloseTo(want, 6);
        expect(out.bloom[i]).toBe(cols.glow[i]);
        if (want === 0) continue;
        const hex = dotColor(cols.tint, i * 4, cols.hue[i] ?? 0, cols.chroma[i] ?? 1, FALLBACK);
        const [r, g, bl] = [0, 1, 2].map((c) => Math.round((out.rgb[i * 3 + c] as number) * 255));
        expect(cssOf(((r as number) << 16) | ((g as number) << 8) | (bl as number))).toBe(
          cssOf(hex),
        );
      }
    }
  });
});
