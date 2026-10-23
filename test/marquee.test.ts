import { mix } from '@msb235/blits';
import { describe, expect, it, vi } from 'vitest';
import { board, KIT, type Led, type Pose, SIZE, type Subject } from '@/board.js';
import { EFFECTS, LAYERS } from '@/builtins.js';
import { stageEffect } from '@/effects.js';
import { rasterize } from '@/font.js';
import { createMarquee } from '@/marquee.js';
import { chase } from '@/modulators/index.js';
import { scrollAcross } from '@/moves/index.js';
import { place } from '@/orders.js';
import { cueLayer, play, type Step } from '@/program.js';

const STEP_MS = scrollAcross.params.step.value;
const CHASE_MS = chase.params.beat.value;

const b = board(SIZE.cols, SIZE.rows);
const COLS = b.cols;
const dot = (x: number, y: number) => b.dots[y * COLS + x] as Led;

describe('rasterize', () => {
  it('lays glyphs out five dots wide with a blank column after each', () => {
    const text = rasterize('ii');
    expect(text.cols).toBe(12);
    expect(text.lit(2, 0)).toBe(true);
    expect(text.lit(0, 0)).toBe(false);
    expect(text.lit(8, 0)).toBe(true);
    expect(text.lit(-1, 0)).toBe(false);
    expect(text.lit(2, 7)).toBe(false);
  });
});

describe('play', () => {
  it('places each step where the one before it ends', () => {
    const m = mix<Subject, Pose>(KIT);
    const steps: Step[] = [
      { effect: 'hold', text: 'I', hex: 0xff9a2e },
      { effect: 'scroll', text: 'I', hex: 0x6dff5a },
    ];
    play(m, b, steps);
    m.sync(0);
    m.sync(1000);
    expect(m.probe(dot(39, 0)).lit).toBe(1);
    expect(m.probe(dot(2, 0)).lit).toBe(0);
    const held = stageEffect(EFFECTS.hold, place(b, rasterize('I')), 0xff9a2e).ms;
    m.sync(held + (COLS + 0.5) * STEP_MS);
    expect(m.probe(dot(2, 0)).lit).toBe(1);
    expect(m.probe(dot(39, 0)).lit).toBe(0);
  });
});

describe('board', () => {
  it('stacks lines of text a dot apart, centered, past one line', () => {
    const big = board(20, 17);
    const rowAt = (y: number) => {
      const led = big.dots[y * 20] as Led;
      return led.kind === 'dot' ? led.row : Number.NaN;
    };
    expect(big.dots).toHaveLength(340);
    expect([0, 1, 7, 8, 9, 15, 16].map(rowAt)).toEqual([-1, 0, 6, -1, 0, 6, -1]);
  });

  it('rings the sign with bulbs two pitches apart', () => {
    const small = board(10, 7);
    expect(small.bulbs.length).toBeGreaterThan(10);
    for (const bulb of small.bulbs) {
      const outside = bulb.x < 0 || bulb.x > 9 || bulb.y < 0 || bulb.y > 6;
      expect(outside).toBe(true);
    }
  });
});

describe('chase', () => {
  it('lights every third bulb through its cell, stepping one bulb a beat', () => {
    const m = mix<Subject, Pose>(KIT);
    cueLayer(m, b, LAYERS.chase, 1);
    for (let beat = 0; beat < 3; beat++) {
      m.sync(beat * CHASE_MS + CHASE_MS / 2);
      b.bulbs.forEach((bulb, j) => {
        const shown = m.probe(b.cells[b.cellOf[j] as number] as Subject).lit;
        const i = bulb.kind === 'bulb' ? bulb.i : -1;
        expect(shown).toBe((i + 3 - beat) % 3 === 0 ? 1 : 0.1);
      });
    }
  });
});

describe('createMarquee', () => {
  it('starts a pass that cues nothing again at the next frame, not at once', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    try {
      let passes = 0;
      const sign = createMarquee({} as HTMLCanvasElement, {
        draw: false,
        program: () => {
          passes++;
          return [{ effect: 'tile', text: 'I', hex: 0 }];
        },
      });
      const settle = () => new Promise((r) => setTimeout(r, 0));
      await settle();
      expect(passes).toBe(1);
      for (let i = 1; i <= 3; i++) {
        (frames.shift() as FrameRequestCallback)(i * 16);
        await settle();
      }
      expect(passes).toBe(4);
      sign.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  /** Runs `body` against a sign with a stubbed frame loop, handing it a way to run a frame. */
  const withSign = async (
    opts: Parameters<typeof createMarquee>[1],
    body: (
      sign: ReturnType<typeof createMarquee>,
      step: (ms: number) => void,
    ) => void | Promise<void>,
  ) => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    try {
      const sign = createMarquee({} as HTMLCanvasElement, { draw: false, ...opts });
      let now = 0;
      // Hops under the hidden-tab gap, which the sign leaves out of the show.
      const step = (ms: number) => {
        while (now < ms) {
          now = Math.min(ms, now + 100);
          (frames.shift() as FrameRequestCallback)(now);
        }
      };
      await body(sign, step);
      sign.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  };

  const GREEN = { colors: [0x00ff00, 0x00ff00] };
  const tintAt = (led: Led, sign: ReturnType<typeof createMarquee>) => [
    ...sign.mix.probe(led).tint,
  ];

  it('setLayer with params re-cues the layer, leaving none of the old params playing', async () => {
    const spec = { mod: 'two-color', params: { depth: 0 } } as const;
    let fresh: number[] = [];
    await withSign(
      { layers: { tinted: { ...spec, params: { depth: 0, ...GREEN } } } },
      (sign, step) => {
        step(100);
        fresh = tintAt(sign.board.dots[0] as Led, sign);
      },
    );
    await withSign({ layers: { tinted: spec } }, (sign, step) => {
      step(100);
      const led = sign.board.dots[0] as Led;
      const before = tintAt(led, sign);
      expect(before.some((v) => v !== 0)).toBe(true);
      sign.setLayer('tinted', true, GREEN);
      step(200);
      expect(tintAt(led, sign)).not.toEqual(before);
      expect(tintAt(led, sign)).toEqual(fresh);
    });
  });

  it('setLayer with params keeps the layer weight', async () => {
    const ring = { mod: 'chase', weight: 0.5 } as const;
    const litCells = (sign: ReturnType<typeof createMarquee>) =>
      sign.board.cells.map((c) => sign.mix.probe(c).lit);
    let fresh: number[] = [];
    await withSign({ layers: { ring: { ...ring, params: { dim: 0.2 } } } }, (sign, step) => {
      step(50);
      fresh = litCells(sign);
    });
    expect(Math.max(...fresh)).toBeCloseTo(0.5);
    await withSign({ layers: { ring } }, (sign, step) => {
      step(100);
      sign.setLayer('ring', true, { dim: 0.2 });
      step(150);
      expect(litCells(sign)).toEqual(fresh);
    });
  });

  it('a bare weight for a layer that does not exist throws', async () => {
    expect(() =>
      createMarquee({} as HTMLCanvasElement, { draw: false, layers: { nope: true } }),
    ).toThrow('bree: no layer named nope');
  });

  it('setLayer on an unknown name with no spec throws', async () => {
    await withSign({}, (sign) => {
      expect(() => sign.setLayer('nope', true)).toThrow('bree: no layer named nope');
    });
  });

  const quick = { name: 'quick', active: { move: 'stand' }, hold: 400 } as const;
  const settle = () => new Promise((r) => setTimeout(r, 0));
  const litAmong = (sign: ReturnType<typeof createMarquee>, from: number, to: number) => {
    let n = 0;
    for (let y = 0; y < SIZE.rows; y++)
      for (let x = from; x < to; x++) n += sign.mix.probe(sign.board.dots[y * COLS + x] as Led).lit;
    return n;
  };

  it('restart from step 2 plays step 2 alone, replacing the pass underway', async () => {
    const steps: Step[] = [
      { effect: 'quick', text: 'WWWW', hex: 0xff9a2e },
      { effect: 'quick', text: 'WWWW', hex: 0xff9a2e },
      { effect: 'quick', text: 'I', hex: 0x6dff5a },
    ];
    await withSign({ program: steps, effects: { quick } }, (sign, step) => {
      step(200);
      expect(litAmong(sign, 28, 36)).toBeGreaterThan(0);
      sign.restart(2);
      step(300);
      expect(litAmong(sign, 28, 36)).toBe(0);
      expect(litAmong(sign, 36, 44)).toBeGreaterThan(0);
    });
  });

  it('restart past the last step falls back to the first', async () => {
    await withSign(
      { program: [{ effect: 'quick', text: 'I', hex: 0 }], effects: { quick } },
      (sign, step) => {
        sign.restart(5);
        step(100);
        expect(litAmong(sign, 36, 44)).toBeGreaterThan(0);
      },
    );
  });

  it('restart mid-pass starts exactly one new pass', async () => {
    let passes = 0;
    await withSign(
      {
        program: () => {
          passes++;
          return [{ effect: 'quick', text: 'I', hex: 0 }];
        },
        effects: { quick },
      },
      async (sign, step) => {
        step(200);
        sign.restart();
        await settle();
        step(500);
        await settle();
        expect(passes).toBe(2);
      },
    );
  });

  it('restart right after a pass ended starts exactly one new pass', async () => {
    let passes = 0;
    await withSign(
      {
        program: () => {
          passes++;
          return [{ effect: 'quick', text: 'I', hex: 0 }];
        },
        effects: { quick },
      },
      async (sign, step) => {
        step(500);
        await settle();
        sign.restart();
        step(600);
        await settle();
        expect(passes).toBe(2);
      },
    );
  });

  it('setEffects applies from the next pass', async () => {
    const stand = { name: 'mine', active: { move: 'stand' }, hold: 1000 } as const;
    await withSign(
      { program: [{ effect: 'mine', text: 'I', hex: 0 }], effects: { mine: stand } },
      (sign, step) => {
        sign.setEffects({ mine: { name: 'mine', active: { move: 'scroll-across' } } });
        sign.restart();
        step((COLS + 0.5) * STEP_MS);
        expect(sign.mix.probe(sign.board.dots[2] as Led).lit).toBe(1);
      },
    );
  });
});
