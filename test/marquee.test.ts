import { mix, watched } from '@msb235/blits';
import { describe, expect, it, vi } from 'vitest';
import { board, KIT, type Led, type Pose, SIZE, type Subject } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { type EffectSpec, stageEffect } from '@/effects.js';
import { rasterize } from '@/font.js';
import { createMarquee } from '@/marquee.js';
import { chase } from '@/modulators/index.js';
import { scrollAcross } from '@/moves/index.js';
import { place } from '@/orders.js';
import { cueLayer, play, type Scene } from '@/program.js';

const STEP_MS = scrollAcross.params.step.value;
const CHASE_MS = chase.params.beat.value;

const b = board(SIZE.cols, SIZE.rows);
const COLS = b.cols;
const dot = (x: number, y: number) => b.dots[y * COLS + x] as Led;

describe('rasterize', () => {
  it('lays monospace glyphs out five dots wide with a blank column after each', () => {
    const text = rasterize('ii', { style: { monospace: true } });
    expect(text.cols).toBe(12);
    expect(text.lit(2, 0)).toBe(true);
    expect(text.lit(0, 0)).toBe(false);
    expect(text.lit(8, 0)).toBe(true);
    expect(text.lit(-1, 0)).toBe(false);
    expect(text.lit(2, 7)).toBe(false);
  });
});

describe('play', () => {
  it('places each scene where the one before it ends', () => {
    const m = mix<Subject, Pose>(KIT);
    const scenes: Scene[] = [
      { effect: 'hold', text: 'I', hex: 0xff9a2e },
      { effect: 'scroll', text: 'I', hex: 0x6dff5a },
    ];
    play(m, b, scenes);
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
    const at = place(big, rasterize('A'));
    const rowAt = (y: number) => at.rowOf(big.dots[y * 20] as Led);
    expect(at.lines).toBe(2);
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

  it('has no bulbs, and a dot of margin, without a border', () => {
    const bare = board(10, 7, false);
    expect(bare.bulbs).toEqual([]);
    expect(bare.margin).toBe(1);
    expect(board(10, 7).margin).toBe(3);
  });
});

describe('chase', () => {
  it('lights every third bulb through its cell, stepping one bulb a beat', () => {
    const m = mix<Subject, Pose>(KIT);
    cueLayer(m, b, { mod: 'chase' }, 1);
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
          return [{ effect: { name: 'empty' }, text: 'I', hex: 0 }];
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

  it('lights its border as setBorder asks', async () => {
    const litCells = (sign: ReturnType<typeof createMarquee>) =>
      sign.board.cells.map((c) => sign.mix.probe(c).lit);
    await withSign({}, (sign, step) => {
      step(50);
      expect(litCells(sign)).toEqual([0, 0, 0]);
      sign.setBorder({ bulbs: 'lit' });
      step(100);
      expect(litCells(sign)).toEqual([1, 1, 1]);
      sign.setBorder({ bulbs: 'chase', dim: 0.2 });
      step(150);
      expect([...litCells(sign)].sort()).toEqual([0.2, 0.2, 1]);
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

  it('a layer turned on late shows what it would have, had it been on from the start', async () => {
    const program = [{ effect: 'hold', text: 'HI', hex: 0xff9a2e }] as const;
    const shown = (sign: ReturnType<typeof createMarquee>) =>
      sign.board.dots.map((d) => {
        const p = sign.mix.probe(d);
        return [p.lit, ...p.tint];
      });
    let always: number[][] = [];
    await withSign({ program, layers: { rainbow: true, sparkle: true } }, (sign, step) => {
      step(1700);
      always = shown(sign);
    });
    await withSign({ program }, (sign, step) => {
      step(900);
      sign.setLayer('rainbow', true);
      sign.setLayer('sparkle', true);
      step(1700);
      expect(shown(sign)).toEqual(always);
      sign.setLayer('rainbow', false);
      sign.setLayer('sparkle', 0);
      step(1800);
      expect(shown(sign)).not.toEqual(always);
    });
  });

  it('a bare weight for a layer that does not exist throws', async () => {
    expect(() =>
      createMarquee({} as HTMLCanvasElement, { draw: false, layers: { nope: true } }),
    ).toThrow('blinken: no layer named nope');
  });

  it('setLayer on an unknown name with no spec throws', async () => {
    await withSign({}, (sign) => {
      expect(() => sign.setLayer('nope', true)).toThrow('blinken: no layer named nope');
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

  it('restart from scene 2 plays scene 2 alone, replacing the pass underway', async () => {
    const scenes: Scene[] = [
      { effect: 'quick', text: 'WWWW', hex: 0xff9a2e },
      { effect: 'quick', text: 'WWWW', hex: 0xff9a2e },
      { effect: 'quick', text: 'I', hex: 0x6dff5a },
    ];
    await withSign({ program: scenes, effects: { quick } }, (sign, step) => {
      step(200);
      expect(litAmong(sign, 28, 36)).toBeGreaterThan(0);
      sign.restart(2);
      step(300);
      expect(litAmong(sign, 28, 36)).toBe(0);
      expect(litAmong(sign, 36, 44)).toBeGreaterThan(0);
    });
  });

  it('restart past the last scene falls back to the first', async () => {
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

  it('setProgram and setEffects refuse a scene naming no effect, at the call', async () => {
    await withSign(
      { program: [{ effect: 'quick', text: 'I', hex: 0 }], effects: { quick } },
      (sign) => {
        expect(() => sign.setProgram([{ effect: 'nope', text: 'I', hex: 0 }])).toThrow(
          'blinken: no effect named nope',
        );
        expect(() => sign.setEffects({})).toThrow('blinken: no effect named quick');
      },
    );
  });

  it('a pass that fails to start is logged, and the sign plays on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let passes = 0;
    try {
      await withSign(
        {
          program: () => {
            passes++;
            if (passes === 2) throw new Error('bad pass');
            return [{ effect: 'quick', text: 'I', hex: 0 }];
          },
          effects: { quick },
          border: { bulbs: 'chase' },
        },
        async (sign, step) => {
          step(400);
          await settle();
          expect(() => step(600)).not.toThrow();
          expect(error).toHaveBeenCalledTimes(1);
          expect(Math.max(...sign.board.cells.map((c) => sign.mix.probe(c).lit))).toBe(1);
          sign.setProgram([{ effect: 'quick', text: 'I', hex: 0 }]);
          step(700);
          expect(litAmong(sign, 36, 44)).toBeGreaterThan(0);
        },
      );
    } finally {
      error.mockRestore();
    }
  });

  describe('paced by input', () => {
    const per = 110;
    const typed: EffectSpec = {
      name: 'typed',
      enter: { move: 'type-on', params: { pace: 'input', ms: per } },
      active: { move: 'stand' },
      hold: 300,
    };
    const program: Scene[] = [{ effect: 'typed', text: 'HI', hex: 0xff9a2e }];

    it('holds at each rest until step, and plays on from the release', async () => {
      await withSign({ program, effects: { typed } }, (sign, step) => {
        step(1000);
        expect(sign.pass()).toMatchObject({ at: per / 2, waiting: true });
        sign.step();
        step(2000);
        expect(sign.pass()).toMatchObject({ at: per + per / 2, waiting: true });
        sign.step();
        expect(sign.pass()).toMatchObject({ at: 2 * per, waiting: false });
        step(2100);
        expect(sign.pass()?.at).toBe(2 * per + 100);
      });
    });

    it('ignores step while playing, and a seek drops the hold', async () => {
      await withSign({ program, effects: { typed } }, (sign, step) => {
        // The pass starts at the first frame.
        step(20);
        sign.step();
        step(40);
        expect(sign.pass()?.at).toBe(20);
        step(1000);
        sign.seek(2 * per);
        expect(sign.pass()?.waiting).toBe(false);
        step(1100);
        expect(sign.pass()?.at).toBe(2 * per + 100);
      });
    });
  });

  describe('pass and seek', () => {
    const two: Scene[] = [
      { effect: 'quick', text: 'WWWW', hex: 0xff9a2e },
      { effect: 'quick', text: 'I', hex: 0x6dff5a },
    ];
    const quickMs = stageEffect(quick, place(b, rasterize('I')), 0).ms;

    it('lays the scenes end to end and reads where the pass is on the mix clock', async () => {
      await withSign({ program: two, effects: { quick } }, (sign, step) => {
        step(100);
        const first = sign.pass();
        expect(first?.length).toBe(2 * quickMs);
        expect(first?.scenes).toMatchObject([
          { scene: 0, start: 0, ms: quickMs },
          { scene: 1, start: quickMs, ms: quickMs },
        ]);
        // A scene's parts are placed in the pass, after the scenes before it.
        const [one, other] = first?.scenes ?? [];
        expect(other?.parts.enter.start).toBe(quickMs + (one?.parts.enter.start ?? Number.NaN));
        expect(other?.parts.exit.start).toBe(quickMs + (one?.parts.exit.start ?? Number.NaN));
        const at = first?.at ?? Number.NaN;
        step(300);
        expect(sign.pass()?.at).toBe(at + 200);
        sign.ramp(0.5, 0);
        step(500);
        expect(sign.pass()?.at).toBe(at + 300);
      });
    });

    it('numbers the scenes of a pass restarted partway by their place in the program', async () => {
      await withSign({ program: two, effects: { quick } }, (sign, step) => {
        step(100);
        sign.restart(1);
        expect(sign.pass()?.scenes).toMatchObject([{ scene: 1, start: 0, ms: quickMs }]);
      });
    });

    it('seeks back into a scene that has ended, and the sign shows it again', async () => {
      await withSign({ program: two, effects: { quick } }, (sign, step) => {
        step(quickMs + 200);
        expect(litAmong(sign, 28, 36)).toBe(0);
        sign.seek(100);
        step(quickMs + 300);
        expect(sign.pass()?.at).toBe(200);
        expect(litAmong(sign, 28, 36)).toBeGreaterThan(0);
      });
    });

    it('holds a seek with hold where it put the pass, until a seek without it', async () => {
      await withSign({ program: two, effects: { quick } }, (sign, step) => {
        step(100);
        sign.seek(quickMs + 100, { hold: true });
        step(3 * quickMs);
        expect(sign.pass()?.at).toBe(quickMs + 100);
        expect(litAmong(sign, 36, 44)).toBeGreaterThan(0);
        sign.seek(quickMs + 100);
        step(3 * quickMs + 100);
        expect(sign.pass()?.at).toBe(quickMs + 200);
      });
    });

    it('plays on from a seek made before the first frame', async () => {
      await withSign({ program: two, effects: { quick } }, (sign, step) => {
        sign.seek(quickMs + 100);
        expect(sign.pass()?.at).toBe(quickMs + 100);
        step(300);
        expect(sign.pass()?.at).toBe(quickMs + 300);
        expect(litAmong(sign, 36, 44)).toBeGreaterThan(0);
      });
    });

    it('clamps a seek to the pass, and has no pass to report with nothing to play', async () => {
      await withSign({ program: two, effects: { quick } }, (sign, step) => {
        step(100);
        sign.seek(-50, { hold: true });
        expect(sign.pass()?.at).toBe(0);
        sign.seek(1e9, { hold: true });
        expect(sign.pass()?.at).toBe(2 * quickMs);
      });
      await withSign({ program: [] }, (sign, step) => {
        step(100);
        expect(sign.pass()).toBeNull();
        expect(() => sign.seek(10)).not.toThrow();
      });
    });
  });

  describe("its mix on the debuggers' list", () => {
    const listed = (name: string) =>
      watched()
        .entries()
        .filter((e) => e.name === name).length;

    it('is named for the canvas and the size, or as told', async () => {
      await withSign({}, () => {
        expect(listed(`marquee ${SIZE.cols}×${SIZE.rows}`)).toBeGreaterThan(0);
      });
      vi.stubGlobal('requestAnimationFrame', () => 0);
      vi.stubGlobal('cancelAnimationFrame', () => {});
      try {
        const canvas = { id: 'hero' } as HTMLCanvasElement;
        const named = createMarquee(canvas, { draw: false, cols: 20, rows: 7 });
        expect(listed('marquee #hero 20×7')).toBe(1);
        named.destroy();
      } finally {
        vi.unstubAllGlobals();
      }
      await withSign({ name: 'lobby' }, () => {
        expect(listed('lobby')).toBe(1);
      });
    });

    it('leaves the list when the sign is destroyed', async () => {
      await withSign({ name: 'short-lived' }, () => {
        expect(listed('short-lived')).toBe(1);
      });
      expect(listed('short-lived')).toBe(0);
    });
  });
});

describe('follow', () => {
  it('wears the followed sign’s color, dot for dot, and keeps its own shape', () => {
    const fns: ((now: number) => void)[] = [];
    const ticker = {
      add(fn: (now: number) => void) {
        fns.push(fn);
        return () => {};
      },
      size: 0,
    };
    const step = (now: number) => {
      for (const fn of fns) fn(now);
    };
    const main = createMarquee({} as HTMLCanvasElement, {
      draw: false,
      backend: '2d',
      ticker,
      cols: 20,
      rows: 7,
      program: [{ effect: 'hold', text: 'A', hex: 0x00ff00 }],
    });
    const mine = createMarquee({} as HTMLCanvasElement, {
      draw: false,
      backend: '2d',
      ticker,
      cols: 10,
      rows: 7,
      follow: { source: () => main, planes: ['color'] },
      program: [{ effect: 'hold', text: 'WW', hex: 0xff0000 }],
    });
    for (let now = 0; now <= 1000; now += 100) step(now);
    const own = createMarquee({} as HTMLCanvasElement, {
      draw: false,
      backend: '2d',
      ticker,
      cols: 10,
      rows: 7,
      program: [{ effect: 'hold', text: 'WW', hex: 0xff0000 }],
    });
    for (let now = 1100; now <= 2000; now += 100) step(now);
    // Dot 3 of a 10-column row sits where dot 7 of a 20-column one does.
    expect([...mine.columns.tint.slice(12, 16)]).toEqual([...main.columns.tint.slice(28, 32)]);
    expect([...mine.columns.tint.slice(12, 16)]).not.toEqual([...own.columns.tint.slice(12, 16)]);
    expect([...mine.columns.lit]).toEqual([...own.columns.lit]);
    for (const m of [main, mine, own]) m.destroy();
  });
});

describe('setHighlight', () => {
  it('swaps the marked dots over what the mix gives, and puts them back when cleared', () => {
    const fns: ((now: number) => void)[] = [];
    const ticker = {
      add(fn: (now: number) => void) {
        fns.push(fn);
        return () => {};
      },
      size: 0,
    };
    const m = createMarquee({} as HTMLCanvasElement, {
      draw: false,
      backend: '2d',
      ticker,
      cols: 10,
      rows: 7,
      program: [{ effect: 'hold', text: 'I', hex: 0xffffff }],
    });
    for (let now = 0; now <= 800; now += 100) for (const fn of fns) fn(now);
    const before = [...m.columns.invert];
    m.setHighlight((dot) => dot.x < 2);
    m.setHighlight((dot) => dot.x < 2);
    m.board.dots.forEach((dot, i) => {
      expect(m.columns.invert[i]).toBe(dot.x < 2 ? 1 - (before[i] ?? 0) : before[i]);
    });
    m.setHighlight(null);
    expect([...m.columns.invert]).toEqual(before);
    m.destroy();
  });
});

describe('backend', () => {
  /** A canvas whose 2D context draws nothing, in a box 160 × 56. */
  const canvas = () => {
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    return {
      getContext: (kind: string) => (kind === '2d' ? ctx : null),
      style: {},
      width: 0,
      height: 0,
      parentElement: { clientWidth: 160, clientHeight: 56 },
    } as unknown as HTMLCanvasElement;
  };
  const ticker = { add: () => () => {}, size: 0 };

  it('draws with what it is asked for, and says so', () => {
    vi.stubGlobal('document', { createElement: canvas });
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    try {
      const m = createMarquee(canvas(), { backend: '2d', ticker });
      expect(m.backend).toBe('2d');
      m.destroy();
      // Node has no WebGL, so a sign left to choose draws with 2D.
      const auto = createMarquee(canvas(), { ticker });
      expect(auto.backend).toBe('2d');
      auto.destroy();
      const asked = createMarquee(canvas(), { backend: 'webgl', ticker });
      expect(asked.backend).toBe('2d');
      asked.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('refuses webgpu without a handle, even when not drawing', () => {
    expect(() =>
      createMarquee({} as HTMLCanvasElement, { draw: false, backend: 'webgpu', ticker }),
    ).toThrow(/needs a gpu handle/);
  });

  it('reports the backend with each frame’s cost, and 2d without drawing', () => {
    const fns: ((now: number) => void)[] = [];
    const costs: string[] = [];
    const m = createMarquee({} as HTMLCanvasElement, {
      draw: false,
      ticker: {
        add(fn) {
          fns.push(fn);
          return () => {};
        },
        size: 0,
      },
      onFrame: (cost) => costs.push(cost.backend),
    });
    for (const fn of fns) fn(0);
    expect(m.backend).toBe('2d');
    expect(costs).toEqual(['2d']);
    m.destroy();
  });
});
