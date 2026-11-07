import { describe, expect, it } from 'vitest';
import { pack, spellOut, stepsFrom } from '@/mechanical/glyphs.js';
import { flapAt, reelAt, reelMs } from '@/mechanical/index.js';

describe('mechanical glyphs', () => {
  it('spells a value by the longest glyph name at each place', () => {
    const names = ['MON', 'TUE', 'M', 'O', 'N', '1', '2'];
    expect(spellOut('MON12', names)).toEqual(['MON', '1', '2']);
    expect(spellOut('mon', names)).toEqual(['MON']);
    expect(spellOut(['M', 'O'], names)).toEqual(['M', 'O']);
    expect(spellOut('M?N', names)).toEqual(['M', 'N']);
  });

  it('packs names to the cells on the side they keep to', () => {
    expect(pack(['4', '2'], 4, 'right', '0')).toEqual(['0', '0', '4', '2']);
    expect(pack(['A', 'B', 'C'], 2, 'left', ' ')).toEqual(['A', 'B']);
    expect(pack(['1', '2', '3'], 2, 'right', '0')).toEqual(['2', '3']);
  });

  it('turns forward only, wrapping', () => {
    expect(stepsFrom(8, 2, 10)).toBe(4);
    expect(stepsFrom(2, 8, 10)).toBe(6);
    expect(stepsFrom(3, 3, 10)).toBe(0);
  });
});

describe('mechanical motion', () => {
  it('a reel eases from its glyph to the next ones and stops on its target', () => {
    const ms = reelMs(4, 10);
    expect(reelAt(2, 4, 0, 10)).toBe(2);
    expect(reelAt(2, 4, ms / 2, 10)).toBeCloseTo(4);
    expect(reelAt(2, 4, ms, 10)).toBe(6);
    expect(reelAt(2, 0, 50, 10)).toBe(2);
  });

  it('a flap shows each card between in turn, a fall part way between them', () => {
    expect(flapAt(0, 3, 0, 10)).toEqual({ card: 0, phase: 0 });
    expect(flapAt(0, 3, 150, 10)).toEqual({ card: 1, phase: 0.5 });
    expect(flapAt(0, 3, 300, 10)).toEqual({ card: 3, phase: 0 });
  });
});
