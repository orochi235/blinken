import { describe, expect, it } from 'vitest';
import { HOUSING } from '@/render/bloom-params.js';
import { housingPaint, lightness, veil } from '@/render/housing.js';
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
    for (const s of [SOCKET.dot, SOCKET.bulb, SOCKET.segment, SOCKET.wire, SOCKET.plate]) {
      const [r, g, b] = dark[s] as readonly [number, number, number, number];
      const hex = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
      const want = lightness(hex) - lightness(HOUSING);
      const [v] = sockets[s] as readonly [number, number, number, number];
      expect(lOf(v)).toBeCloseTo(want, 0);
      expect(sockets[s]?.[3]).toBeLessThan(0.5);
    }
  });

  it('lays lights over a see-through housing and adds them to the dark one', () => {
    expect(housingPaint('dark').lights).toBe('add');
    expect(housingPaint('clear').lights).toBe('over');
  });
});
