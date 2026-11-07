import { describe, expect, it } from 'vitest';
import { dl3422 } from '@/readout/types/dl3422.js';

const one = (ch: string) => [...(dl3422.encode(ch, 1, 'left')[0] ?? [])].sort();
const sorted = (s: string) => s.split(' ').sort();
const PRINTABLE = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
const NAMES = new Set(dl3422.cell.lights.map((l) => l.name));

describe('dl3422', () => {
  it('has the part’s 20 segments and two dots', () => {
    expect(dl3422.cell.lights).toHaveLength(22);
    expect(NAMES.size).toBe(22);
  });

  it('encodes every printable ASCII character, and only with its own lights', () => {
    for (const ch of PRINTABLE) {
      const lit = one(ch);
      if (ch !== ' ') expect(lit.length, JSON.stringify(ch)).toBeGreaterThan(0);
      for (const n of lit) expect(NAMES.has(n), `${JSON.stringify(ch)} lights ${n}`).toBe(true);
    }
  });

  it('tells lowercase from uppercase', () => {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz')
      expect(one(ch), ch).not.toEqual(one(ch.toUpperCase()));
  });

  it('draws the datasheet’s lowercase', () => {
    expect(one('e')).toEqual(sorted('g1 e k d1'));
    expect(one('k')).toEqual(sorted('f e g1 n'));
    expect(one('g')).toEqual(sorted('g1 e l d1 o q1'));
    expect(one('j')).toEqual(sorted('udot l o q1'));
    expect(one('p')).toEqual(sorted('g2 l c d2 o'));
    expect(one('q')).toEqual(sorted('g1 e l d1 o q2'));
    expect(one('y')).toEqual(sorted('e l d1 o q1'));
    expect(one('x')).toEqual(sorted('k n'));
  });

  it('draws digits in the left half and punctuation with the dots', () => {
    expect(one('0')).toEqual(sorted('a1 f i e l d1'));
    expect(one('M')).toEqual(sorted('f e b c h j'));
    expect(one(':')).toEqual(sorted('udot ldot'));
    expect(one(',')).toEqual(sorted('ldot o'));
    expect(one('$')).toEqual(sorted('a1 a2 f i g1 g2 l c d1 d2 o'));
  });

  it('gives a period its own cell, as the part does', () => {
    expect(dl3422.encode('A.', 2, 'left').map((s) => [...s].sort())).toEqual([one('A'), ['ldot']]);
  });

  it('defaults to the part’s red', () => {
    expect(dl3422.color).toBe(0xff2a1a);
  });
});
