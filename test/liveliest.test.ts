import { describe, expect, it } from 'vitest';
import { EFFECTS } from '@/builtins.js';
import { liveliest } from '@/liveliest.js';

const at = (effect: string) =>
  liveliest({ cols: 32, program: [{ effect, text: 'OPEN', hex: 0xff9a2e }] });

describe('liveliest', () => {
  it('finds a moment past the start for every built-in', () => {
    for (const name of Object.keys(EFFECTS)) expect(at(name)).toBeGreaterThan(0);
  });

  it('gives 0 for a message that only stands', () => {
    const still = { name: 'still', active: { move: 'stand' } } as const;
    expect(
      liveliest({
        cols: 32,
        effects: { still },
        program: [{ effect: 'still', text: 'OPEN', hex: 0xff9a2e }],
      }),
    ).toBe(0);
  });
});
