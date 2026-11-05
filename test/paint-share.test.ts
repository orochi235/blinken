import { describe, expect, it } from 'vitest';
import { decode, encode } from '../lab/paint/share.js';

describe('paint links', () => {
  const linked = {
    layout: { cols: 30, rows: 11, grid: 'triangles' as const },
    picture: {
      '2,3': { hex: 0xb2e81b, level: 1 },
      '3,3': { hex: 0xb2e81b, level: 1 },
      '-1,4': { hex: 0xff0000, level: 0.5 },
    },
  };

  it('round trips a board and its dots', () => {
    expect(decode(`#${encode(linked)}`)).toEqual(linked);
  });

  it('reads no picture from an empty hash, a composition or garbage', () => {
    expect(decode('')).toBeNull();
    expect(decode('#not base64!')).toBeNull();
    expect(decode(`#${btoa('{"bree":"composition"}')}`)).toBeNull();
  });

  it('skips dots it cannot read and falls back to the square grid', () => {
    const json = JSON.stringify({
      bree: 'picture',
      cols: 10,
      rows: 8,
      grid: 'nonsense',
      dots: [[255, 1, '1,1 x,y'], [-4, 1, '2,2'], 'junk'],
    });
    expect(decode(btoa(json))).toEqual({
      layout: { cols: 10, rows: 8, grid: 'square' },
      picture: { '1,1': { hex: 255, level: 1 } },
    });
  });
});
