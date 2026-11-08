import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { FACE_NAMES, type Face, type Look, rasterize } from '@/font.js';
import { MOVES, type Move, type MoveName } from '@/moves/index.js';
import { place } from '@/orders.js';
import { values } from '@/params.js';

const setting = {} as never;
const b = board(80, 7);
const at = place(b, rasterize('HI'));
const names = Object.keys(MOVES) as MoveName[];
const slotted = (slot: string) => names.filter((n) => MOVES[n].slot === slot);

/** The lit channel of every dot, `t` ms into a pass of the move. */
function litAt(m: Move, t: number, where = at, given: Record<string, unknown> = {}) {
  const p = { ...values(m), ...given } as never;
  const patch = m.patch(where, p);
  const phase = Math.min(1, t / patch.duration);
  return where.board.dots.map((d) => patch.at(phase, d, setting).lit ?? 0);
}

const shown = (left = at.left, text = at.text, on = b) => {
  const rowOf = place(on, text).rowOf;
  return on.dots.map((d) => (rowOf(d) >= 0 ? text.level(d.x - left, rowOf(d)) : 0));
};
const STEP = (MOVES['scroll-across'].params.step as { value: number }).value;
const length = (m: Move, where = at) => m.patch(where, values(m)).duration;

/** Every face plain, and the standard face in each style. */
const LOOKS: readonly Look[] = [
  ...FACE_NAMES.map((face) => ({ face })),
  { style: { monospace: true } },
  { face: 'bold', style: { monospace: true } },
  { style: { outline: true } },
  { style: { shadow: true } },
  { face: 'slim', style: { outline: true, shadow: true } },
];
const lookName = (look: Look) =>
  [look.face ?? 'standard', ...Object.keys(look.style ?? {})].join(' ');

/** Each look on `HI`, and two lines on a sign tall enough for both. */
const CASES = [
  ...LOOKS.map((look) => ({ name: lookName(look), at: place(b, rasterize('HI', look)) })),
  { name: 'two lines', at: place(board(80, 15), rasterize('HI\nYOU')) },
];

describe('moves in every look', () => {
  for (const { name: caseName, at } of CASES) {
    describe(caseName, () => {
      for (const name of slotted('enter')) {
        it(`${name} ends showing the message`, () => {
          const m = MOVES[name];
          expect(litAt(m, length(m, at), at)).toEqual(shown(at.left, at.text, at.board));
        });
      }

      for (const name of slotted('enter').filter((n) => n !== 'unfold')) {
        for (const direction of ['left', 'right']) {
          it(`${name} shows no lit dots at phase 0 (${direction})`, () => {
            expect(litAt(MOVES[name], 0, at, { direction }).every((v) => v === 0)).toBe(true);
          });
        }
      }

      for (const name of slotted('exit')) {
        it(`${name} starts showing the message and ends blank`, () => {
          const m = MOVES[name];
          expect(litAt(m, 0, at)).toEqual(shown(at.left, at.text, at.board));
          expect(litAt(m, length(m, at), at).every((v) => v === 0)).toBe(true);
        });
      }

      it('stand shows the message the whole time', () => {
        const m = MOVES.stand;
        for (const f of [0, 0.3, 0.99])
          expect(litAt(m, f * length(m, at), at)).toEqual(shown(at.left, at.text, at.board));
      });
    });
  }
});

describe('moves', () => {
  it('stand shows the message the whole time', () => {
    const m = MOVES.stand;
    for (const f of [0, 0.3, 0.99])
      expect(litAt(m, f * length(m))).toEqual(shown(at.left, at.text, at.board));
  });

  it('scroll-across enters at the right edge and leaves at the left', () => {
    const m = MOVES['scroll-across'];
    const end = length(m);
    expect(litAt(m, 0).every((v) => v === 0)).toBe(true);
    const first = litAt(m, 1.5 * STEP);
    const lit = b.dots.filter((_, i) => first[i] === 1).map((d) => d.x);
    expect(lit.length).toBeGreaterThan(0);
    expect(Math.min(...lit)).toBe(b.cols - 1);
    expect(litAt(m, end).every((v) => v === 0)).toBe(true);
    const last = litAt(m, end - 3.5 * STEP);
    const left = b.dots.filter((_, i) => last[i] === 1).map((d) => d.x);
    expect(left.length).toBeGreaterThan(0);
    expect(Math.max(...left)).toBeLessThan(5);
  });

  it('scroll-across carries on from an enter move and comes round again for an exit move', () => {
    const m = MOVES['scroll-across'];
    const p = values(m) as never;
    const frame = (joins: { from: boolean; to: boolean }, t: number) => {
      const patch = m.patch(at, p, joins);
      return b.dots.map((d) => patch.at(Math.min(1, t / patch.duration), d, setting).lit ?? 0);
    };
    const both = { from: true, to: true };
    expect(frame(both, 0)).toEqual(shown());
    expect(frame(both, STEP * 3)).toEqual(shown(at.left - 3));
    expect(frame(both, length(m))).toEqual(shown());
    // It takes as long to come round as to cross from edge to edge.
    expect(m.patch(at, p, both).duration).toBe(length(m));
    expect(frame({ from: true, to: false }, 0)).toEqual(shown());
    expect(frame({ from: false, to: true }, Number.MAX_SAFE_INTEGER)).toEqual(shown());
  });

  it('scroll-across crosses the other way when rightward', () => {
    const m = MOVES['scroll-across'];
    const step = STEP;
    const first = litAt(m, 3.5 * step, at, { direction: 'right' });
    const lit = b.dots.filter((_, i) => first[i] === 1).map((d) => d.x);
    expect(lit.length).toBeGreaterThan(0);
    expect(Math.max(...lit)).toBeLessThan(5);
  });

  it('tile draws the same frame at phase 0 and phase 1', () => {
    const tall = board(80, 16);
    const m = MOVES.tile;
    const patch = m.patch(place(tall, at.text), values(m));
    const frame = (phase: number) => tall.dots.map((d) => patch.at(phase, d, setting).lit ?? 0);
    expect(frame(1)).toEqual(frame(0));
    expect(frame(0).some((v) => v === 1)).toBe(true);
  });

  it('tile lights a one-line board', () => {
    const b7 = board(80, 7);
    const at = place(b7, rasterize('HI'));
    const tiled = MOVES.tile.patch(at, values(MOVES.tile));
    expect(b7.dots.some((d) => tiled.at(0, d, setting).lit === 1)).toBe(true);
  });

  it('every move stages an empty message without throwing', () => {
    const empty = place(b, rasterize(''));
    for (const name of names) {
      const m = MOVES[name];
      const len = length(m, empty);
      expect(len).toBeGreaterThan(0);
      for (const f of [0, 0.5, 1]) expect(() => litAt(m, f * len, empty)).not.toThrow();
    }
  });

  it('every move declares its slot and settings as data', () => {
    for (const name of names) {
      const m = MOVES[name];
      expect(m.name).toBe(name);
      expect(['enter', 'active', 'exit']).toContain(m.slot);
      expect(JSON.parse(JSON.stringify(m.params))).toEqual(m.params);
    }
  });
});

it('reel-in spins through the glyphs of its own face when two faces share a name', () => {
  const face = (dot: string): Face => ({
    name: 'mine',
    rows: 7,
    width: 5,
    glyph: () => Array.from({ length: 7 }, () => dot.repeat(5)),
  });
  const m = MOVES['reel-in'];
  const spin = (f: Face) => {
    const where = place(b, rasterize('HI', { face: f }));
    return [0.2, 0.4, 0.6].flatMap((u) => litAt(m, u * length(m, where), where));
  };
  expect(spin(face('#')).some((v) => v > 0)).toBe(true);
  expect(spin(face('.')).every((v) => v === 0)).toBe(true);
});

describe('moves over two lines', () => {
  const two = place(board(80, 17), rasterize('MI\nIWM'));
  const { text } = two;
  const yOf = (r: number) => two.board.dots.find((d) => two.rowOf(d) === r)?.y ?? Number.NaN;
  const litOn = (frame: readonly number[], x: number, y: number) =>
    frame[two.board.dots.findIndex((d) => d.x === x && d.y === y)] === 1;
  const body = text.face.rows - (text.face.above ?? 0) - (text.face.below ?? 0);

  it('split-in splits each line through its own letters', () => {
    const m = MOVES['split-in'];
    const frame = litAt(m, length(m, two) * 0.3, two);
    for (const line of [0, 1]) {
      const first = line * text.pitch + text.above;
      for (let r = first; r < first + body; r++) {
        const standing = [...Array(text.cols).keys()].filter((x) => text.lit(x, r));
        if (standing.length === 0) continue;
        const moved = two.board.dots
          .filter((d) => d.y === yOf(r) && litOn(frame, d.x, d.y))
          .map((d) => d.x - two.left);
        // The top half comes in from the left, so it stands left of where it lands.
        if (r < first + Math.ceil(body / 2))
          expect(Math.min(...moved, Infinity)).toBeLessThan(standing[0] as number);
        else expect(Math.max(...moved, -Infinity)).toBeGreaterThan(standing.at(-1) as number);
      }
    }
  });

  it('wave by letter bobs each letter of either line whole', () => {
    const m = MOVES.wave;
    const given = { length: 4, height: 1 };
    for (const t of [300, 700, 1100, 1900]) {
      const frame = litAt(m, t, two, given);
      text.letters.forEach((span, k) => {
        const dots: [number, number][] = [];
        for (let r = 0; r < text.rows; r++)
          for (let x = span.x; x < span.x + span.width; x++)
            if (text.lit(x, r) && text.letterAt(x, r) === k) dots.push([x, r]);
        const fits = [-1, 0, 1].some((dy) =>
          dots.every(([x, r]) => litOn(frame, x + two.left, yOf(r) + dy)),
        );
        expect(fits, `letter ${k} at ${t} ms`).toBe(true);
      });
    }
  });
});
