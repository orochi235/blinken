import { describe, expect, it } from 'vitest';
import { board, SIZE } from '@/board.js';
import { scrollAcross } from '@/moves/index.js';
import { fallAt, layOut } from '@/pass.js';
import { stageProgram } from '@/program.js';

const b = board(SIZE.cols, SIZE.rows);
const STEP = scrollAcross.params.step.value;

describe('a move asking for a shorter fall', () => {
  const staged = stageProgram(
    b,
    [
      { effect: 'hold', text: 'I', hex: 0xff9a2e },
      { effect: 'scroll', text: 'HI', hex: 0xff9a2e, params: { speed: 100 } },
    ],
    {},
  );
  const { scenes } = layOut(staged, 0);
  const [hold, scroll] = scenes as [(typeof scenes)[0], (typeof scenes)[0]];

  it('limits the fall to under a column step while it scrolls', () => {
    const mid = scroll.parts.active.start + scroll.parts.active.ms / 2;
    expect(fallAt(scenes, mid)).toBe(75);
    expect(fallAt(scenes, mid)).toBeLessThan(100);
  });

  it('leaves the fall alone in a scene with no such move, and outside the pass', () => {
    expect(fallAt(scenes, hold.start + hold.ms / 2)).toBeUndefined();
    expect(fallAt(scenes, scroll.start + scroll.ms + 1)).toBeUndefined();
  });

  it('asks for less than the default column time takes', () => {
    const [plain] = layOut(stageProgram(b, [{ effect: 'scroll', text: 'HI', hex: 0 }], {}), 0)
      .scenes as [(typeof scenes)[0]];
    expect(fallAt([plain], plain.parts.active.start + 1)).toBeLessThan(STEP);
  });
});
