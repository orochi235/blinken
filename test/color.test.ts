import { oklab } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { dotColor } from '@/color.js';

const bytes = (hex: number) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

describe('dotColor', () => {
  it('shows the tint unchanged at hue 0 and chroma 1', () => {
    const got = bytes(dotColor(oklab(0xff9a2e), 0, 0, 1, 0));
    bytes(0xff9a2e).forEach((want, k) => {
      expect(Math.abs((got[k] as number) - want)).toBeLessThanOrEqual(1);
    });
  });

  it('turns the hue by the hue channel', () => {
    const [r, g] = bytes(dotColor(oklab(0xff0000), 0, 120, 1, 0));
    expect(g).toBeGreaterThan(r as number);
  });

  it('goes gray at chroma 0', () => {
    const [r, g] = bytes(dotColor(oklab(0xff4030), 0, 0, 0, 0));
    expect(Math.abs((r as number) - (g as number))).toBeLessThanOrEqual(2);
  });

  it('reads the tint at an offset in a column of them', () => {
    const column = [0, 0, 0, 0, ...oklab(0xff9a2e)];
    expect(dotColor(column, 4, 0, 1, 0)).toBe(dotColor(oklab(0xff9a2e), 0, 0, 1, 0));
    expect(dotColor(column, 0, 0, 1, 0x123456)).toBe(0x123456);
  });

  it('falls back when nothing tinted the dot', () => {
    expect(dotColor([0, 0, 0, 0], 0, 0, 1, 0x123456)).toBe(0x123456);
  });

  it('turns and grays the fallback as it does a tint', () => {
    const none = [0, 0, 0, 0];
    expect(dotColor(none, 0, 120, 1, 0xff0000)).toBe(dotColor(oklab(0xff0000), 0, 120, 1, 0));
    expect(dotColor(none, 0, 0, 0, 0xff4030)).toBe(dotColor(oklab(0xff4030), 0, 0, 0, 0));
  });

  it('lays a tint covering the dot partly over the fallback, not over black', () => {
    const half = oklab(0x0000ff).map((v, k) => (k < 3 ? v * 0.5 : 0.5));
    const [r, , b] = bytes(dotColor(half, 0, 0, 1, 0xff0000));
    expect(r).toBeGreaterThan(64);
    expect(b).toBeGreaterThan(64);
    expect(dotColor(half, 0, 0, 1, 0xff0000)).not.toBe(dotColor(half, 0, 0, 1, 0));
  });
});
