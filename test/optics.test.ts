import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { ghosts, settle } from '@/optics.js';

describe('settle', () => {
  it('lights faster than it goes dark by default', () => {
    expect(settle(0, 1, 12)).toBeGreaterThan(1 - settle(1, 0, 12));
  });

  it('follows the fade it is given', () => {
    expect(settle(0, 1, 100, { rise: 100 })).toBeCloseTo(1 - Math.exp(-1));
    expect(settle(1, 0, 50, { fall: 100 })).toBeCloseTo(Math.exp(-0.5));
  });

  it('jumps straight there with no fade', () => {
    expect(settle(0, 1, 16, { rise: 0 })).toBe(1);
    expect(settle(1, 0, 0, { fall: 0 })).toBe(0);
  });
});

describe('ghosts', () => {
  const b = board(5, 3);
  const shown = new Float64Array(b.dots.length + b.bulbs.length);
  const out = new Float64Array(shown.length);
  // The middle row lit across, nothing else.
  for (let x = 0; x < 5; x++) shown[5 + x] = 1;

  it('shows nothing with no ghosting', () => {
    ghosts(b, shown, {}, out);
    expect([...out.subarray(0, 15)].every((v) => v === 0)).toBe(true);
  });

  it('leaks a lit column into the dots above and below it', () => {
    ghosts(b, shown, { col: 0.2 }, out);
    // Dot (2, 0) shares column 2 with one lit dot of the two others in it.
    expect(out[2]).toBeCloseTo(0.1);
    expect(out[7]).toBe(0);
  });

  it('leaks a row only into dark dots sharing it', () => {
    shown.fill(0);
    shown[0] = 1;
    ghosts(b, shown, { row: 0.4 }, out);
    expect(out[1]).toBeCloseTo(0.1);
    expect(out[5]).toBe(0);
    expect(out[0]).toBe(0);
  });
});
