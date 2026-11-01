import { afterEach, describe, expect, it, vi } from 'vitest';
import { board } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { type EffectSpec, stageEffect } from '@/effects.js';
import { MODULATORS } from '@/modulators/index.js';
import { placeText } from '@/orders.js';
import { type NumberParam, values } from '@/params.js';
import type { Scene } from '@/program.js';
import { BLEND, HOLD, LAG } from '@/tuning.js';
import { decode, encode, shareOf, toCode } from '../lab/compose/share.js';
import type { ComposeState } from '../lab/compose/state.js';
import {
  DRAFT,
  hasPrevious,
  KEPT,
  load,
  open,
  PREVIOUS,
  restorePrevious,
  save,
} from '../lab/compose/storage.js';

const state = (): ComposeState => ({
  effects: {
    'hold copy': {
      name: 'hold copy',
      order: { by: 'column', lag: 14 },
      enter: [{ move: 'cut-on' }],
      active: [{ move: 'stand' }, { mod: 'two-color', params: { colors: [0xff0000, 0x0000ff] } }],
      hold: 2000,
    },
  },
  program: [
    {
      text: 'HI',
      hex: 0xff9a2e,
      effect: 'hold copy',
      layers: { rainbow: { on: true, params: { rate: 2 } } },
    },
    { text: 'THERE', hex: 0x6dff5a, effect: 'flip', hold: 1500 },
  ],
  editing: { scene: 0 },
});

/** A hash carrying `data` as links were written before they were packed. */
const hashOf = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64url');
/** A composition's share data as plain JSON, to edit into a broken link. */
const dataOf = (s: ComposeState) => JSON.parse(JSON.stringify(shareOf(s)));

describe('share', () => {
  it('round-trips a composition through the hash', () => {
    const { state: back, dropped } = decode(`#${encode(state())}`);
    expect(dropped).toEqual([]);
    const { editing: _, ...want } = state();
    const { editing: __, ...got } = back;
    expect(got).toEqual(want);
  });

  it('drops an unknown move from a link and names it', () => {
    const s = state();
    const data = dataOf(s);
    data.effects['hold copy'].enter = [{ move: 'moonwalk' }, { move: 'cut-on' }];
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.effects['hold copy']?.enter).toEqual([{ move: 'cut-on' }]);
    expect(dropped).toEqual(['move moonwalk in hold copy']);
  });

  it('drops unknown modulators, effects and layers, and scenes naming a dropped effect', () => {
    const data = dataOf(state());
    data.effects['hold copy'].active.push({ mod: 'wobble' });
    data.effects.bad = { name: 'bad', active: 'nonsense' };
    data.program.push({ text: 'X', hex: 0, effect: 'nowhere' });
    data.program[0].layers.fog = { on: true };
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.effects['hold copy']?.active).toHaveLength(2);
    expect(back.program.map((s) => s.text)).toEqual(['HI', 'THERE']);
    expect(Object.keys(back.program[0]?.layers ?? {})).toEqual(['rainbow']);
    expect(dropped).toEqual([
      'modulator wobble in hold copy',
      'effect bad',
      'layer fog of scene HI',
      'scene X, its effect nowhere',
    ]);
  });

  it('clamps holds to the lab’s range, and leaves settings for values to clamp', () => {
    const data = dataOf(state());
    data.effects['hold copy'].exit = [{ mod: 'dim', params: { sweep: 1, ms: -5, depth: 0.5 } }];
    data.effects['hold copy'].hold = -100;
    data.program[1].hold = 1e9;
    const { state: back } = decode(hashOf(data));
    const exit = back.effects['hold copy']?.exit as readonly { params: Record<string, number> }[];
    expect(exit[0]?.params).toEqual({ sweep: 1, ms: -5, depth: 0.5 });
    expect(values(MODULATORS.dim, exit[0]?.params as never)).toMatchObject({
      sweep: 0.95,
      ms: 100,
    });
    expect(back.effects['hold copy']?.hold).toBe(0);
    expect(back.program[1]?.hold).toBe(12000);
  });

  it('reads a broken link as unread, with the demo program', () => {
    for (const hash of ['#not-json!', `#${hashOf([1, 2])}`, `#${hashOf('x')}`]) {
      const { state: back, read } = decode(hash);
      expect(read).toBe(false);
      expect(back.program[0]?.text).toBe('BLITS');
    }
  });

  it('drops a __proto__ effect, naming it, and keeps one named constructor', () => {
    const spec = { active: [{ move: 'stand' }] };
    const json = `{"effects":{"__proto__":${JSON.stringify({ name: '__proto__', ...spec })},"constructor":${JSON.stringify({ name: 'constructor', ...spec })}},"program":[{"text":"A","hex":0,"effect":"__proto__"},{"text":"B","hex":0,"effect":"constructor"}]}`;
    const { state: back, dropped } = decode(Buffer.from(json).toString('base64url'));
    expect(Object.getPrototypeOf(back.effects)).toBe(Object.prototype);
    expect(Object.keys(back.effects)).toEqual(['constructor']);
    expect(back.program.map((s) => s.text)).toEqual(['B']);
    expect(dropped).toEqual(['effect __proto__', 'scene A, its effect __proto__']);
    expect(decode(encode(back)).state.effects.constructor?.name).toBe('constructor');
  });

  it('names settings of the wrong type and maps that are not maps', () => {
    const data = dataOf(state());
    data.effects['hold copy'].hold = '500';
    data.effects['hold copy'].active[1].params.colors = 'red';
    data.program[0].hex = [1];
    data.program[0].layers = [];
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.effects['hold copy']?.hold).toBeUndefined();
    expect(back.program[0]?.hex).toBe(0xff9a2e);
    expect(back.program[0]?.layers).toBeUndefined();
    expect(dropped).toEqual([
      'setting colors in hold copy',
      'hold in hold copy',
      'color in scene HI',
      'the layers of scene HI',
    ]);
  });

  it('names a program that is not a list, and leaves it empty', () => {
    const { state: back, dropped, read } = decode(hashOf({ effects: {}, program: {} }));
    expect(read).toBe(true);
    expect(back.program).toEqual([]);
    expect(dropped).toEqual(['the program']);
  });

  it('gives a valid, empty program when every scene is dropped', () => {
    const { state: back, dropped } = decode(
      hashOf({ program: [{ text: 'A', hex: 0, effect: 'gone' }, 7] }),
    );
    expect(back.program).toEqual([]);
    expect(back.editing).toEqual({ scene: 0 });
    expect(dropped).toEqual(['scene A, its effect gone', 'a scene']);
    expect(decode(encode(back)).state.program).toEqual([]);
  });

  it('writes code that names every designed effect and scene', () => {
    const code = toCode(state());
    expect(code).toMatch(/^createMarquee\(canvas, \{/);
    expect(code).toContain('"hold copy": {');
    expect(code).toContain('text: "HI"');
    expect(code).toContain('{ text: "THERE", hex: 0x6dff5a, effect: "flip", hold: 1500 }');
    expect(code).toContain('colors: [0xff0000, 0x0000ff]');
    expect(code).toContain('layers: { rainbow: { params: { rate: 2, phase: 0.015 } } }');
    expect(code).not.toContain('flip: {');
  });

  it('writes code with every number held to its range, as it plays', () => {
    const rate = MODULATORS['hue-cycle'].params.rate as NumberParam;
    const s = state();
    s.effects['hold copy'] = {
      ...(s.effects['hold copy'] as EffectSpec),
      order: { by: 'column', lag: 99999 },
      active: [{ mod: 'hue-cycle', spread: { by: 'column', lag: -5 }, params: { rate: 1e9 } }],
      hold: 99999,
      blend: 99999,
    };
    s.program[1] = {
      ...(s.program[1] as Scene),
      hold: 99999,
      params: { blend: -5 },
      layers: { rainbow: { params: { rate: -1e9 } } },
    };
    const code = toCode(s);
    expect(code).not.toMatch(/99999|1000000000|-5\b/);
    expect(code).toContain(`order: { by: "column", lag: ${LAG.max} }`);
    expect(code).toContain(`spread: { by: "column", lag: ${LAG.min} }`);
    expect(code).toContain(`params: { rate: ${rate.max} }`);
    expect(code).toContain(`hold: ${HOLD.max}`);
    expect(code).toContain(`blend: ${BLEND.max}`);
    expect(code).toContain(`params: { blend: ${BLEND.min} }`);
    expect(code).toContain(`rate: ${rate.min}`);
  });

  it('leaves out a tuning value of the wrong kind, which tuning ignores as it plays', () => {
    const s = state();
    s.program[1] = { ...(s.program[1] as Scene), params: { blend: 'loud' } } as never;
    expect(toCode(s)).not.toContain('loud');
  });

  it('writes an untouched layer as true and leaves out layers that are off', () => {
    const s = state();
    s.program[1] = {
      ...s.program[1],
      layers: { sparkle: { on: true }, rainbow: { on: false } },
    } as never;
    const code = toCode(s);
    expect(code).toContain('layers: { sparkle: true }');
  });

  it('rebuilds every built-in from a link: a copy decodes and stages as the built-in does', () => {
    const s: ComposeState = { effects: {}, program: [], editing: {} };
    for (const [name, spec] of Object.entries(EFFECTS))
      s.effects[`${name} copy`] = { ...spec, name: `${name} copy` };
    const { state: back, dropped } = decode(encode(s));
    expect(dropped).toEqual([]);
    const at = placeText(board(80, 15), 'HELLO');
    for (const [name, spec] of Object.entries(EFFECTS)) {
      const want = stageEffect(spec, at, 0xff9a2e);
      const got = stageEffect(back.effects[`${name} copy`] as typeof spec, at, 0xff9a2e);
      expect(got.ms, name).toBe(want.ms);
      expect(JSON.stringify(got.arcs), name).toBe(JSON.stringify(want.arcs));
      expect(got.warnings, name).toEqual(want.warnings);
    }
  });

  it('round-trips a scene’s face and style, and writes them as code', () => {
    const s = state();
    s.program[0] = { ...(s.program[0] as Scene), face: 'slim', style: { shadow: true } };
    s.program[1] = { ...(s.program[1] as Scene), style: { monospace: true } };
    const { state: back, dropped } = decode(`#${encode(s)}`);
    expect(dropped).toEqual([]);
    expect(back.program).toEqual(s.program);
    const code = toCode(s);
    expect(code).toContain('face: "slim"');
    expect(code).toContain('style: { shadow: true }');
    expect(code).toContain('style: { monospace: true }');
  });

  it('puts the layers of a link from before scenes had their own on every scene', () => {
    const old = hashOf({
      effects: {},
      program: [
        { text: 'A', hex: 0xff9a2e, effect: 'hold' },
        { text: 'B', hex: 0xff9a2e, effect: 'hold', layers: { sparkle: { on: true } } },
      ],
      layers: { rainbow: { on: true } },
    });
    const { state: back, dropped } = decode(old);
    expect(dropped).toEqual([]);
    expect(back.program.map((s) => s.layers)).toEqual([
      { rainbow: { on: true } },
      { rainbow: { on: true }, sparkle: { on: true } },
    ]);
  });

  it('reads a link written before scenes had faces, dropping nothing', () => {
    const old = hashOf({
      effects: {},
      program: [{ text: 'HI', hex: 0xff9a2e, effect: 'hold', hold: 1500 }],
      layers: {},
    });
    const { state: back, dropped } = decode(old);
    expect(dropped).toEqual([]);
    expect(back.program).toEqual([
      { text: 'HI', hex: 0xff9a2e, effect: 'hold', hold: 1500, style: { monospace: true } },
    ]);
  });

  it('reads a JSON link’s proportional scene as one without monospace', () => {
    const old = hashOf({
      effects: {},
      program: [{ text: 'HI', hex: 0xff9a2e, effect: 'hold', style: { proportional: true } }],
    });
    const { state: back, dropped } = decode(old);
    expect(dropped).toEqual([]);
    expect(back.program[0]?.style).toBeUndefined();
  });

  it('reads sparkle’s old rate setting as its share', () => {
    const old = hashOf({
      effects: {
        mine: { name: 'mine', active: [{ mod: 'sparkle', params: { rate: 0.03 } }] },
      },
      program: [
        {
          text: 'HI',
          hex: 0,
          effect: 'mine',
          layers: { sparkle: { on: true, params: { rate: 0.02 } } },
        },
      ],
    });
    const { state: back, dropped } = decode(old);
    expect(dropped).toEqual([]);
    expect(back.program[0]?.layers?.sparkle).toEqual({ on: true, params: { share: 0.02 } });
    expect(back.effects.mine?.active).toEqual([{ mod: 'sparkle', params: { share: 0.03 } }]);
  });

  it('names a face no built-in has and style switches it does not know', () => {
    const data = dataOf(state());
    data.program[0].face = 'gothic';
    data.program[1].style = { reverse: true, blink: true, proportional: 'yes' };
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.program[0]?.face).toBeUndefined();
    expect(back.program[1]?.style).toEqual({ monospace: true });
    // Reverse text is gone; a scene that had it plays the invert layer.
    expect(back.program[1]?.layers?.invert).toEqual({ on: true });
    expect(dropped).toEqual([
      'face in scene HI',
      'blink in style in scene THERE',
      'proportional in style in scene THERE',
    ]);
  });

  it('names an effect param that drives nothing the effect has, and tuning its scene lacks', () => {
    const data = dataOf(state());
    data.effects = {
      mine: {
        name: 'mine',
        active: [{ move: 'stand' }],
        params: {
          good: { label: 'good', about: '', to: ['active.0.ms'] },
          bad: { label: 'bad', about: '', to: ['enter.4.ms'] },
        },
      },
    };
    data.program[0] = { text: 'HI', hex: 0, effect: 'mine', params: { good: 900, nope: 1 } };
    const { state: back, dropped } = decode(hashOf(data));
    expect(Object.keys(back.effects.mine?.params ?? {})).toEqual(['good']);
    expect(back.program[0]?.params).toEqual({ good: 900 });
    expect(dropped).toContain('param bad of mine');
    expect(dropped).toContain('setting nope in scene HI');
  });

  it('escapes every control character in code strings', () => {
    const s = state();
    s.program = [{ text: "A\r\nB'\u0001", hex: 0, effect: 'hold' }];
    const code = toCode(s);
    expect(code).toContain('text: "A\\r\\nB\'\\u0001"');
    expect([...code].some((c) => c !== '\n' && c.charCodeAt(0) < 0x20)).toBe(false);
  });
});

describe('the draft in browser storage', () => {
  const store = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('saves and loads a draft, and loads null without one or without storage', () => {
    vi.stubGlobal('localStorage', store());
    expect(load()).toBeNull();
    save(state());
    expect(load()?.program).toEqual(state().program);
    vi.stubGlobal('localStorage', undefined);
    expect(() => save(state())).not.toThrow();
    expect(load()).toBeNull();
  });

  it('keeps the draft an unreadable link would have replaced', () => {
    vi.stubGlobal('localStorage', store());
    save(state());
    const opened = open('#not-json!');
    expect(opened.unreadable).toBe(true);
    expect(opened.state.program).toEqual(state().program);
    expect(load()?.program).toEqual(state().program);
    expect(hasPrevious()).toBe(false);
  });

  it('moves the draft aside when a link replaces it, and swaps it back', () => {
    vi.stubGlobal('localStorage', store());
    save(state());
    const other = { ...state(), program: [{ text: 'LINKED', hex: 0, effect: 'hold' }] };
    const opened = open(`#${encode(other)}`);
    expect(opened.state.program[0]?.text).toBe('LINKED');
    expect(load()?.program[0]?.text).toBe('LINKED');
    expect(hasPrevious()).toBe(true);
    expect(restorePrevious()?.program[0]?.text).toBe('HI');
    expect(load()?.program[0]?.text).toBe('HI');
    expect(JSON.parse(localStorage.getItem(PREVIOUS) ?? '')).toEqual([encode(other)]);
    expect(localStorage.getItem(DRAFT)).toBe(encode(state()));
  });

  const titled = (text: string): ComposeState => ({
    ...state(),
    program: [{ text, hex: 0, effect: 'hold' }],
  });

  it('keeps the last few drafts links replaced, skipping repeats, and steps back through them', () => {
    vi.stubGlobal('localStorage', store());
    save(titled('A'));
    open(`#${encode(titled('B'))}`);
    open(`#${encode(titled('A'))}`);
    open(`#${encode(titled('C'))}`);
    expect(JSON.parse(localStorage.getItem(PREVIOUS) ?? '')).toEqual([
      encode(titled('A')),
      encode(titled('B')),
    ]);
    const steps = [0, 1, 2].map(() => restorePrevious()?.program[0]?.text);
    expect(steps).toEqual(['A', 'B', 'C']);
    expect(load()?.program[0]?.text).toBe('C');
  });

  it('keeps at most KEPT displaced drafts', () => {
    vi.stubGlobal('localStorage', store());
    save(titled('0'));
    for (let i = 1; i <= KEPT + 3; i++) open(`#${encode(titled(String(i)))}`);
    const kept: string[] = JSON.parse(localStorage.getItem(PREVIOUS) ?? '');
    expect(kept).toHaveLength(KEPT);
    expect(decode(kept[0] ?? '').state.program[0]?.text).toBe(String(KEPT + 2));
  });

  it('reads a single draft kept before the list, and skips unreadable ones', () => {
    vi.stubGlobal('localStorage', store());
    save(titled('NOW'));
    localStorage.setItem(PREVIOUS, encode(titled('OLD')));
    expect(restorePrevious()?.program[0]?.text).toBe('OLD');
    localStorage.setItem(PREVIOUS, JSON.stringify(['not-json!', encode(titled('NOW'))]));
    expect(restorePrevious()?.program[0]?.text).toBe('NOW');
  });

  it('keeps no previous draft when the link holds the same composition', () => {
    vi.stubGlobal('localStorage', store());
    save(state());
    open(`#${encode(state())}`);
    expect(hasPrevious()).toBe(false);
  });
});
