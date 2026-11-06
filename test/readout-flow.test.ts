import { describe, expect, it } from 'vitest';
import { flow } from '@/readout/flow.js';

const chars = (s: string) => [...s];

describe('flow', () => {
  it('fits one line as before: text keeps its first cells, numbers their last', () => {
    expect(flow(chars('HELLO'), 3, 1, 'left', true).at).toEqual([0, 1, 2, -1, -1]);
    expect(flow(chars('12345'), 3, 1, 'right', true).at).toEqual([-1, -1, 0, 1, 2]);
    expect(flow(chars('12'), 4, 1, 'right', true).at).toEqual([2, 3]);
  });

  it('wraps a word that would run over to the next line, dropping the space it wraps at', () => {
    const f = flow(chars('HI THERE'), 5, 2, 'left', true);
    expect(f.at).toEqual([0, 1, 2, 5, 6, 7, 8, 9]);
    expect(flow(chars('ABC DEF'), 4, 2, 'left', true).at).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(flow(chars('ABCD EF'), 4, 2, 'left', true).at).toEqual([0, 1, 2, 3, -1, 4, 5]);
    expect(f.cut).toBe(0);
  });

  it('breaks a word longer than a line across lines', () => {
    expect(flow(chars('ABCDEF'), 4, 2, 'left', true).at).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('starts a line at a line break, and cuts what runs past the last line', () => {
    const f = flow(chars('A\nB\nC'), 3, 2, 'left', true);
    expect(f.at).toEqual([0, -1, 3, -1, -1]);
    expect(f.cut).toBe(1);
  });

  it('keeps a long line whole without wrap, cut at the edge', () => {
    expect(flow(chars('ABCDE'), 3, 2, 'left', false).at).toEqual([0, 1, 2, -1, -1]);
  });

  it('aligns each line on its own', () => {
    expect(flow(chars('AB\nC'), 3, 2, 'right', true).at).toEqual([1, 2, -1, 5]);
  });

  it('stands a caret under the next character, past the last one, or at a new line after a break', () => {
    expect(flow(chars('AB'), 4, 1, 'left', true).carets).toEqual([0, 1, 2]);
    expect(flow(chars('AB\n'), 4, 2, 'left', true).carets).toEqual([0, 1, 2, 4]);
    expect(flow([], 4, 1, 'right', true).carets).toEqual([3]);
  });
});
