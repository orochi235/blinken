import { describe, expect, it, vi } from 'vitest';
import { board } from '@/board.js';
import { faceOf } from '@/faces.js';
import { rasterize } from '@/font.js';
import { GRIDS, pointsUp, TRI_H, triangleAt, triangleUnder } from '@/grid.js';
import { createMarquee } from '@/marquee.js';
import { placeText } from '@/orders.js';
import { TYPES } from '@/readout/types/index.js';
import { PRIM, primBuilder, radiusOfPrim, SOCKET, sdf } from '@/render/prims.js';
import { boardLights } from '@/render/sign-lights.js';

const INRADIUS = 1 / (2 * Math.sqrt(3));

describe('the triangle tiling', () => {
  it('points triangles up and down in turn, along a row and down a column', () => {
    expect([0, 1, 2, 3].map((k) => pointsUp(k, 0))).toEqual([true, false, true, false]);
    expect([0, 1].map((r) => pointsUp(0, r))).toEqual([true, false]);
  });

  it('gives neighbors along a row a shared edge, and each its middle a third of the way in', () => {
    const a = triangleAt(0, 0).corners.map(String);
    const b = triangleAt(1, 0).corners.map(String);
    expect(a.filter((c) => b.includes(c))).toHaveLength(2);
    expect(triangleAt(0, 0).middle).toEqual([0.5, (2 * TRI_H) / 3]);
    expect(GRIDS.triangles(1, 0)).toEqual([1, TRI_H / 3]);
  });

  it('finds the triangle a point falls in, right up to its edges', () => {
    for (let r = -2; r <= 3; r++)
      for (let k = -3; k <= 6; k++) {
        const { corners, middle } = triangleAt(k, r);
        expect(triangleUnder(...middle)).toEqual([k, r]);
        // Most of the way from the middle to each corner is still inside.
        for (const [cx, cy] of corners)
          expect(
            triangleUnder(middle[0] + (cx - middle[0]) * 0.95, middle[1] + (cy - middle[1]) * 0.95),
          ).toEqual([k, r]);
      }
  });
});

describe('a triangle primitive', () => {
  const b = primBuilder();
  b.tri(0, 0, SOCKET.dot, triangleAt(0, 0).corners, { lampScaled: true });
  b.tri(1, 0, SOCKET.dot, triangleAt(1, 0).corners);
  const p = b.build();
  const [mx, my] = triangleAt(0, 0).middle;

  it('is its inradius below 0 at its middle and 0 at its corners', () => {
    expect(p.kind[0]).toBe(PRIM.tri);
    expect(sdf(p, 1, ...triangleAt(1, 0).middle)).toBeCloseTo(-INRADIUS, 6);
    expect(sdf(p, 1, 0.5, 0)).toBeCloseTo(0, 6);
    expect(sdf(p, 1, 0.5, -1)).toBeCloseTo(1, 6);
  });

  it('shrinks toward its middle with the lamp size, where lamp-scaled', () => {
    expect(radiusOfPrim(p, 0, 0.72)).toBeCloseTo(INRADIUS * 0.9, 6);
    expect(sdf(p, 0, mx, my, 0.72)).toBeCloseTo(-INRADIUS * 0.9, 6);
    expect(radiusOfPrim(p, 0, 2)).toBeCloseTo(INRADIUS, 6);
  });
});

describe('a sign on the triangle tiling', () => {
  it('draws each dot as a triangle and each bulb as a disc', () => {
    const b = board(6, 3, true, 'triangles');
    const leds = [...b.dots, ...b.bulbs];
    const { prims } = boardLights(b, leds, GRIDS.triangles);
    for (const [i, led] of leds.entries())
      expect(prims.kind[i]).toBe(led.kind === 'dot' ? PRIM.tri : PRIM.disc);
  });

  it('lights two places for each dot of a face, a dot apart between letters', () => {
    const b = board(40, 7, false, 'triangles');
    const plain = rasterize('TT');
    const shown = placeText(b, 'TT').text;
    expect(shown.cols).toBe(plain.cols * 2 - 1);
    for (let y = 0; y < plain.rows; y++)
      for (let x = 0; x < plain.cols; x++)
        for (const d of [0, 1]) expect(shown.lit(x * 2 + d, y)).toBe(plain.lit(x, y));
  });

  it('draws the strokes face as it is, a place to a triangle', () => {
    const b = board(40, 14, false, 'triangles');
    expect(placeText(b, 'I', { face: 'strokes' }).text.face.name).toBe('strokes');
  });

  it('is twice as many places across by default', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    try {
      const m = createMarquee({} as HTMLCanvasElement, { draw: false, grid: 'triangles' });
      expect(m.board.cols).toBe(160);
      expect(m.board.grid).toBe('triangles');
      m.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the strokes face', () => {
  const strokes = faceOf('strokes');

  it('draws an O as a ring, lit at its sides and dark in its middle', () => {
    const o = strokes.glyph('O') as readonly string[];
    expect(o).toHaveLength(14);
    const mid = o[7] as string;
    expect(mid.slice(0, 5)).toContain('#');
    expect(mid.slice(-5)).toContain('#');
    expect(mid.slice(6, 8)).toBe('..');
  });

  it('has nothing for a character the 16-segment set lacks', () => {
    expect(strokes.glyph('€')).toBeUndefined();
  });
});

describe('triangle readouts', () => {
  it('light both triangles of each dot of a 5 × 7 glyph', () => {
    const [on] = TYPES.triangles.encode('I', 1, 'left');
    const top = faceOf('standard').glyph('I')?.[0] as string;
    for (const [x, c] of [...top].entries())
      for (const d of [0, 1]) expect(on?.has(`${x * 2 + d},0`)).toBe(c === '#');
  });

  it('carry the tiling on from cell to cell', () => {
    // A cell an even number of triangles across steps on by half that many pitches.
    expect(TYPES.triangles.cell.width + TYPES.triangles.gap).toBe(6);
    expect(TYPES['triangles-fine'].cell.width + TYPES['triangles-fine'].gap).toBe(7);
  });
});
