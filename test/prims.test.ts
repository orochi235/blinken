import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { GRIDS } from '@/grid.js';
import { boardPrims, lightTable } from '@/render/lights.js';
import {
  boxOf,
  ENDS,
  NO_LIGHT,
  PRIM,
  primBuilder,
  radiusOfPrim,
  SOCKET,
  sdf,
} from '@/render/prims.js';

describe('sdf', () => {
  const b = primBuilder();
  b.disc(0, 0, SOCKET.dot, 2, 3, 1.5);
  b.bar(1, 0, SOCKET.segment, 0, 0, 10, 0, 1, ENDS.round);
  b.bar(2, 0, SOCKET.segment, 0, 0, 10, 0, 1, ENDS.square);
  b.bar(3, 0, SOCKET.segment, 0, 0, 10, 0, 1, ENDS.point);
  b.poly(
    4,
    0,
    SOCKET.wire,
    [
      [0, 0],
      [4, 0],
      [4, 4],
    ],
    0.5,
  );
  b.plate(1, 0, 0, 10, 6, 1);
  const p = b.build();

  it('is a disc’s radius below 0 at its center, and 0 on its rim', () => {
    expect(sdf(p, 0, 2, 3)).toBeCloseTo(-1.5, 6);
    expect(sdf(p, 0, 3.5, 3)).toBeCloseTo(0, 6);
  });

  it('is a bar’s half width below 0 on its axis, and grows past its ends by its end style', () => {
    for (const k of [1, 2, 3]) expect(sdf(p, k, 5, 0)).toBeCloseTo(-1, 6);
    expect(sdf(p, 1, 12, 0)).toBeCloseTo(1, 6);
    expect(sdf(p, 2, 12, 0)).toBeCloseTo(2, 6);
    expect(sdf(p, 2, 11, 2)).toBeCloseTo(Math.SQRT2, 6);
  });

  it('tapers a pointed bar to its tip a half width past its end', () => {
    expect(sdf(p, 3, 11, 0)).toBeCloseTo(0, 6);
    expect(sdf(p, 3, 5, 1)).toBeCloseTo(0, 6);
    expect(sdf(p, 3, 10.9, 0.5)).toBeGreaterThan(0);
  });

  it('is a polyline’s nearest segment less its half width', () => {
    expect(sdf(p, 4, 2, 0)).toBeCloseTo(-0.5, 6);
    expect(sdf(p, 4, 4, 2)).toBeCloseTo(-0.5, 6);
    expect(sdf(p, 4, 2, 2)).toBeCloseTo(1.5, 6);
  });

  it('is a rounded box for a plate, which no light owns', () => {
    expect(p.light[5]).toBe(NO_LIGHT);
    expect(p.kind[5]).toBe(PRIM.plate);
    expect(sdf(p, 5, 5, 3)).toBeCloseTo(-3, 6);
    expect(sdf(p, 5, 5, 7)).toBeCloseTo(1, 6);
    expect(sdf(p, 5, 0, 0)).toBeCloseTo(Math.SQRT2 - 1, 6);
  });

  it('bounds each primitive', () => {
    expect(boxOf(p, 0)).toEqual({ x0: 0.5, y0: 1.5, x1: 3.5, y1: 4.5 });
    expect(boxOf(p, 4)).toEqual({ x0: -0.5, y0: -0.5, x1: 4.5, y1: 4.5 });
  });
});

describe('boardPrims', () => {
  const b = board(3, 2);
  const leds = [...b.dots, ...b.bulbs];
  const t = lightTable(b, leds, GRIDS.hex);
  const p = boardPrims(t);

  it('gives each light one lamp-scaled disc at its place, in view 0', () => {
    expect(p.n).toBe(leds.length);
    for (const [i, led] of leds.entries()) {
      expect(p.light[i]).toBe(i);
      expect(p.view[i]).toBe(0);
      expect(p.kind[i]).toBe(PRIM.disc);
      expect(p.socket[i]).toBe(led.kind === 'bulb' ? SOCKET.bulb : SOCKET.dot);
      expect(sdf(p, i, t.at[i * 2] as number, t.at[i * 2 + 1] as number, 0.72)).toBeCloseTo(
        -(t.radius[i] as number) * 0.72,
        5,
      );
      expect(radiusOfPrim(p, i, 0.72)).toBeCloseTo((t.radius[i] as number) * 0.72, 6);
    }
  });
});
