import { describe, expect, it } from 'vitest';
import { dl2416 } from '@/readout/types/dl2416.js';

const one = (ch: string) => [...(dl2416.encode(ch, 1, 'left')[0] ?? [])].sort();
const sorted = (s: string) => s.split(' ').sort();
const SET = Array.from({ length: 64 }, (_, i) => String.fromCharCode(0x20 + i));

describe('dl2416', () => {
  it('lights every character of the datasheet’s set, and only lights the cell has', () => {
    const names = new Set(dl2416.cell.lights.map((l) => l.name));
    expect(names.size).toBe(17);
    for (const ch of SET.slice(1)) {
      const on = one(ch);
      expect(on.length, ch).toBeGreaterThan(0);
      for (const n of on) expect(names.has(n), `${ch}: ${n}`).toBe(true);
    }
    expect(one(' ')).toEqual([]);
  });

  it('draws glyphs as the datasheet does', () => {
    expect(one('0')).toEqual(sorted('a1 a2 b c d1 d2 e f'));
    expect(one('3')).toEqual(sorted('a1 a2 b c d1 d2 g2'));
    expect(one('!')).toEqual(sorted('i dp'));
    expect(one('<')).toEqual(sorted('d1 d2 j k'));
    expect(one('@')).toEqual(sorted('a1 a2 b c d1 d2 e g1 l'));
    expect(one('D')).toEqual(sorted('a1 a2 b c d1 d2 i l'));
    expect(one('J')).toEqual(sorted('a1 a2 d1 e i l'));
    expect(one('V')).toEqual(sorted('e f j k'));
    expect(one('[')).toEqual(sorted('a1 d1 e f'));
  });

  it('shows lowercase as uppercase, and nothing past the set', () => {
    for (const ch of 'abcxyz') expect(one(ch)).toEqual(one(ch.toUpperCase()));
    expect(dl2416.spell?.shown?.('q')).toBe('Q');
    for (const ch of '`{|}~') expect(one(ch)).toEqual([]);
  });

  it('gives a period its own cell', () => {
    expect(dl2416.encode('1.5', 3, 'left').map((s) => [...s].sort())).toEqual([
      sorted('b c'),
      ['dp'],
      sorted('a1 a2 c d1 d2 f g1 g2'),
    ]);
  });

  it('keeps its lights inside the cell', () => {
    for (const l of dl2416.cell.lights)
      for (const s of l.shapes) {
        const xs = s.kind === 'bar' ? [s.x1, s.x2] : s.kind === 'disc' ? [s.x] : [];
        for (const x of xs) {
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThan(15);
        }
      }
  });
});
