import { describe, expect, it } from 'vitest';
import { layOutReadouts } from '@/readout/layout.js';
import { TYPES } from '@/readout/types/index.js';
import { NO_LIGHT, PRIM, SOCKET } from '@/render/prims.js';

describe('layOutReadouts', () => {
  const seven = TYPES.seven;
  const fourteen = TYPES.fourteen;
  const l = layOutReadouts([
    { type: seven, cells: 4, face: 'plate' },
    { type: fourteen, cells: 2, face: 'none' },
  ]);

  it('gives each readout a band of rows, a row per slot and a column per cell', () => {
    expect(l.board.cols).toBe(4);
    expect(l.board.rows).toBe(seven.cell.lights.length + fourteen.cell.lights.length);
    expect(l.spots.map((s) => s.base)).toEqual([0, seven.cell.lights.length]);
    expect(l.leds).toBe(l.board.dots);
  });

  it('draws nothing for board places no readout fills', () => {
    const lit = new Set(l.prims.light);
    const base = seven.cell.lights.length;
    for (let y = base; y < l.board.rows; y++)
      for (let x = 2; x < 4; x++) expect(lit.has(y * l.board.cols + x)).toBe(false);
  });

  it('puts a plate only behind a readout with a faceplate, and no sockets on one without', () => {
    const plates = [...l.prims.kind.keys()].filter((k) => l.prims.kind[k] === PRIM.plate);
    expect(plates.map((k) => l.prims.view[k])).toEqual([0]);
    expect(l.prims.light[plates[0] as number]).toBe(NO_LIGHT);
    for (let k = 0; k < l.prims.n; k++)
      if (l.prims.view[k] === 1) expect(l.prims.socket[k]).toBe(SOCKET.none);
  });

  it('leads with a ½ digit in column 0 where asked', () => {
    const h = layOutReadouts([{ type: seven, cells: 3, face: 'plate', half: true }]);
    expect(h.board.cols).toBe(4);
    expect(h.spots[0]?.first).toBe(1);
  });
});
