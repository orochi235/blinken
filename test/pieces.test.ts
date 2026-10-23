import { mix } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { rasterize } from '@/font.js';
import { MOVES } from '@/moves/index.js';
import { place } from '@/orders.js';
import { values } from '@/params.js';
import { stagePiece } from '@/pieces.js';

const b = board(40, 7);
const at = place(b, rasterize('HI'));

describe('pieces', () => {
  it('stages a move piece with its order as stagger and its duration including the stagger', () => {
    const order = { by: 'column', lag: 10 } as const;
    const { voice, writes, warnings } = stagePiece(
      { move: 'scroll-in', order },
      'enter',
      at,
      b.dots,
    );
    const length = MOVES['scroll-in'].patch(at, values(MOVES['scroll-in'])).duration;
    expect(voice.duration).toBe(length + 39 * 10);
    expect(voice.stagger?.(b.dots[39] as Subject)).toBe(390);
    expect(voice.loop).toBeUndefined();
    expect(voice.subjects).toBe(b.dots);
    expect(writes).toEqual(['lit']);
    expect(warnings).toEqual([]);
    expect(() => mix<Subject, Pose>(KIT).cue({ ...voice, patch: voice.patch })).not.toThrow();
  });

  it('stages a modulator piece looping on its own subjects', () => {
    const dots = stagePiece({ mod: 'pulse' }, 'active', at, b.dots);
    expect(dots.voice.loop).toBe(true);
    expect(dots.voice.subjects).toBe(b.dots);
    expect(dots.writes).toEqual(['gain']);
    const some = b.dots.slice(0, 5);
    expect(stagePiece({ mod: 'pulse' }, 'active', at, some).voice.subjects).toBe(some);
    const cells = stagePiece({ mod: 'chase' }, 'active', at, some);
    expect(cells.voice.subjects).toBe(b.cells);
    expect(stagePiece({ mod: 'pulse' }, 'enter', at, b.dots).voice.loop).toBeUndefined();
  });

  it('plays an active piece with no length of its own once over the hold', () => {
    const ms = (piece: Parameters<typeof stagePiece>[0], slot: 'active' | 'enter', hold?: number) =>
      stagePiece(piece, slot, at, b.dots, hold).voice.patch.duration;
    expect(ms({ move: 'tumble' }, 'active', 5000)).toBe(5000);
    expect(ms({ mod: 'flash' }, 'active', 5000)).toBe(5000);
    expect(ms({ move: 'tumble', params: { ms: 800 } }, 'active', 5000)).toBe(800);
    expect(ms({ move: 'tumble' }, 'active')).toBe(1200);
    expect(ms({ mod: 'flare' }, 'enter', 5000)).toBe(1500);
  });

  it('refuses a move in the wrong slot', () => {
    expect(() => stagePiece({ move: 'cut-on' }, 'exit', at, b.dots)).toThrow(
      'bree: cut-on is an enter move',
    );
  });

  it('warns when a centered move clips a wide message', () => {
    const wide = { ...place(board(20, 7), rasterize('HELLO WORLD')), label: 'HELLO WORLD' };
    const { warnings } = stagePiece({ move: 'cut-on' }, 'enter', wide, wide.board.dots);
    expect(warnings).toEqual(['cut-on clips HELLO WORLD']);
    expect(stagePiece({ move: 'scroll-in' }, 'enter', wide, wide.board.dots).warnings).toEqual([]);
  });
});
