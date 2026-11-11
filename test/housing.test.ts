import { oklab } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { rgb } from '@/color.js';
import { HOUSING } from '@/render/bloom-params.js';
import { housingPaint, lightness, veil } from '@/render/housing.js';
import { LED } from '@/render/lights.js';
import { SOCKET } from '@/render/prims.js';

/** The L* of an sRGB gray channel `v`. */
const lOf = (v: number) => {
  const c = Math.round(Math.min(Math.max(v, 0), 1) * 255);
  return lightness((c << 16) | (c << 8) | c);
};

describe('the clear housing', () => {
  it('lifts black and darkens white by the same lightness', () => {
    for (const delta of [1, 4, 8, 16]) {
      const [g, , , a] = veil(delta);
      // Composited as a page does, in sRGB: premultiplied color plus the page times 1 − alpha.
      expect(lOf(g)).toBeCloseTo(delta, 0);
      expect(100 - lOf(g + (1 - a))).toBeCloseTo(delta, 0);
    }
  });

  it('gives each socket the contrast it has on the dark housing', () => {
    const sockets = housingPaint('clear').sockets ?? [];
    const dark = housingPaint('dark').sockets ?? [];
    for (const s of [SOCKET.dot, SOCKET.bulb, SOCKET.segment, SOCKET.wire]) {
      const [r, g, b] = dark[s] as readonly [number, number, number, number];
      const hex = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
      const want = lightness(hex) - lightness(HOUSING);
      const [v] = sockets[s] as readonly [number, number, number, number];
      expect(lOf(v)).toBeCloseTo(want, 0);
      expect(sockets[s]?.[3]).toBeLessThan(0.5);
    }
  });

  it('keeps a faceplate as solid as on the dark housing', () => {
    expect(housingPaint('clear').sockets?.[SOCKET.plate]).toEqual(
      housingPaint('dark').sockets?.[SOCKET.plate],
    );
  });

  it('lays lights over a see-through housing and adds them to the dark one', () => {
    expect(housingPaint('dark').lights).toBe('add');
    expect(housingPaint('clear').lights).toBe('over');
  });

  it("keeps most of a lit dot's color at its center, which a white page can't brighten", () => {
    const chroma = (hex: number) => {
      const [, a = 0, b = 0] = oklab(hex);
      return Math.hypot(a, b);
    };
    const hexOf = (c: readonly number[]) =>
      c.reduce((h, v) => (h << 8) | Math.round(Math.min(Math.max(v, 0), 1) * 255), 0);
    for (const housing of ['clear', 'none'] as const)
      for (const color of [0xff2020, 0xff9a2e, 0x30ff50, 0x3080ff]) {
        const k = housingPaint(housing).coreAlpha;
        const tint = rgb(LED.coreTint);
        const center = rgb(color).map((v, i) => (tint[i] as number) * k + v * (1 - k));
        expect(chroma(hexOf(center)), `${housing} ${color.toString(16)}`).toBeGreaterThan(
          0.75 * chroma(color),
        );
      }
  });
});
