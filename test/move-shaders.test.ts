import { describe, expect, it } from 'vitest';
import { board, everyOf } from '@/board.js';
import { rasterize } from '@/font.js';
import { hasTables } from '@/modulators/shader.js';
import { type Joins, LOOSE, MOVES, type MoveName } from '@/moves/index.js';
import { bitmapTables } from '@/moves/shader.js';
import { place, placeText } from '@/orders.js';
import { values } from '@/params.js';
import { stagePiece } from '@/pieces.js';

const setting = {} as never;
const b = board(60, 7);
const narrow = placeText(b, 'HI');
const wide = placeText(b, 'A MESSAGE FAR WIDER THAN THE BOARD');
const names = Object.keys(MOVES) as MoveName[];
const JOINS: Joins[] = [
  LOOSE,
  { from: true, to: false },
  { from: false, to: true },
  { from: true, to: true },
];
/** Settings past the defaults that take another branch of a shader. */
const more: Partial<Record<MoveName, Record<string, unknown>[]>> = {
  'scroll-in': [{ direction: 'right' }],
  'scroll-out': [{ direction: 'right' }],
  'scroll-across': [{ direction: 'right' }],
  'type-on': [{ cursor: 'line' }, { cursor: 'off' }, { pace: 'input' }],
  'type-off': [{ cursor: 'line' }, { cursor: 'off' }],
  'bounce-in': [{ bounces: 0 }, { bounces: 5, ms: 4000 }],
  tumble: [{ turns: 0 }, { turns: 6 }],
  'rain-in': [
    { spread: 0, churn: 0 },
    { drops: 8, tail: 20, spread: 0.9 },
  ],
  'rain-out': [{ drops: 1, churn: 60 }],
  wave: [
    { by: 'column', height: 3 },
    { ms: 500, length: 4 },
  ],
};
const PHASES = [0, 0.03, 0.137, 0.25, 0.4999, 0.5, 0.61, 0.861, 0.97, 1];

describe('bitmapTables', () => {
  it('holds the text by row, and each dot row’s text row plus 1 wherever it shows one', () => {
    const at = place(b, rasterize('HI'));
    const t = bitmapTables(at);
    expect(t.width).toBe(at.text.cols);
    for (let y = 0; y < at.text.rows; y++)
      for (let x = 0; x < at.text.cols; x++)
        expect(t.bitmap[y * t.width + x]).toBe(at.text.level(x, y));
    for (let y = -3 * at.text.rows; y < b.rows + 3 * at.text.rows; y++)
      expect(t.rows[y + t.lead] ?? 0).toBe(at.rowOf({ kind: 'dot', x: 0, y }) + 1);
  });
});

describe('move shaders', () => {
  for (const name of names.filter((n) => MOVES[n].shader))
    it(`${name}: the shader's at gives what patch does on every dot, and 0 on cells`, () => {
      const m = MOVES[name];
      let checked = 0;
      for (const at of [narrow, wide])
        for (const given of [{}, ...(more[name] ?? [])])
          for (const joins of m.slot === 'active' ? JOINS : [LOOSE]) {
            const p = values(m, given as never) as never;
            const sp = m.shader?.(at, p, joins);
            if (!sp) continue;
            checked++;
            const plain = m.patch(at, p, joins);
            expect(sp.duration).toBe(plain.duration);
            for (const phase of PHASES) {
              for (const d of b.dots)
                expect(sp.at(phase, d, setting).lit).toBeCloseTo(
                  plain.at(phase, d, setting).lit ?? 0,
                  6,
                );
              for (const c of b.cells) expect(sp.at(phase, c, setting)).toEqual({ lit: 0 });
            }
          }
      expect(checked > 0).toBe(hasTables());
    });
});

describe('stagePiece', () => {
  const stand = { move: 'stand' } as const;
  it('stages a move on every dot at once as its shader on every subject for the gpu engine', () => {
    const { voice } = stagePiece(stand, 'active', narrow, b.dots, undefined, LOOSE, true);
    if (!hasTables()) return;
    expect(voice.subjects).toBe(everyOf(b));
    expect(voice.stagger).toBeUndefined();
    expect(voice.patch.at(0, b.cells[0] as never, setting)).toEqual({ lit: 0 });
  });

  it('stages the plain patch for the stock mixer, and for an order that staggers the dots', () => {
    for (const [piece, gpu] of [
      [stand, false],
      [{ ...stand, order: { by: 'column', lag: 20 } }, true],
    ] as const) {
      const { voice } = stagePiece(piece, 'active', narrow, b.dots, undefined, LOOSE, gpu);
      expect(voice.subjects).toBe(b.dots);
      expect(voice.stagger).toBeDefined();
    }
  });
});
