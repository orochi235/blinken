import { afterEach, describe, expect, it, vi } from 'vitest';
import { board } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { stageEffect } from '@/effects.js';
import { MODULATORS } from '@/modulators/index.js';
import { placeText } from '@/orders.js';
import { values } from '@/params.js';
import type { Step } from '@/program.js';
import { decode, encode, toCode } from '../lab/compose/share.js';
import type { ComposeState } from '../lab/compose/state.js';
import {
  DRAFT,
  hasPrevious,
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
    { text: 'HI', hex: 0xff9a2e, effect: 'hold copy' },
    { text: 'THERE', hex: 0x6dff5a, effect: 'flip', hold: 1500 },
  ],
  layers: {
    rainbow: {
      mod: 'hue-cycle',
      spread: { by: 'column' },
      params: { rate: 2, phase: 0.015 },
      on: true,
    },
  },
  editing: { step: 0 },
});

/** A hash carrying `data` as encode writes it. */
const hashOf = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64url');

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
    const data = JSON.parse(Buffer.from(encode(s), 'base64url').toString());
    data.effects['hold copy'].enter = [{ move: 'moonwalk' }, { move: 'cut-on' }];
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.effects['hold copy']?.enter).toEqual([{ move: 'cut-on' }]);
    expect(dropped).toEqual(['move moonwalk in hold copy']);
  });

  it('drops unknown modulators, effects and layers, and steps naming a dropped effect', () => {
    const data = JSON.parse(Buffer.from(encode(state()), 'base64url').toString());
    data.effects['hold copy'].active.push({ mod: 'wobble' });
    data.effects.bad = { name: 'bad', active: 'nonsense' };
    data.program.push({ text: 'X', hex: 0, effect: 'nowhere' });
    data.layers.fog = { on: true };
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.effects['hold copy']?.active).toHaveLength(2);
    expect(back.program.map((s) => s.text)).toEqual(['HI', 'THERE']);
    expect(Object.keys(back.layers)).toEqual(['rainbow']);
    expect(dropped).toEqual([
      'modulator wobble in hold copy',
      'effect bad',
      'step X, its effect nowhere',
      'layer fog',
    ]);
  });

  it('clamps holds to the lab’s range, and leaves settings for values to clamp', () => {
    const data = JSON.parse(Buffer.from(encode(state()), 'base64url').toString());
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
    expect(dropped).toEqual(['effect __proto__', 'step A, its effect __proto__']);
    expect(decode(encode(back)).state.effects.constructor?.name).toBe('constructor');
  });

  it('names settings of the wrong type and maps that are not maps', () => {
    const data = JSON.parse(Buffer.from(encode(state()), 'base64url').toString());
    data.effects['hold copy'].hold = '500';
    data.effects['hold copy'].active[1].params.colors = 'red';
    data.program[0].hex = [1];
    data.layers = [];
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.effects['hold copy']?.hold).toBeUndefined();
    expect(back.program[0]?.hex).toBe(0xff9a2e);
    expect(back.layers).toEqual({});
    expect(dropped).toEqual([
      'setting colors in hold copy',
      'hold in hold copy',
      'color in step HI',
      'the layers',
    ]);
  });

  it('names a program that is not a list, and leaves it empty', () => {
    const { state: back, dropped, read } = decode(hashOf({ effects: {}, program: {} }));
    expect(read).toBe(true);
    expect(back.program).toEqual([]);
    expect(dropped).toEqual(['the program']);
  });

  it('gives a valid, empty program when every step is dropped', () => {
    const { state: back, dropped } = decode(
      hashOf({ program: [{ text: 'A', hex: 0, effect: 'gone' }, 7] }),
    );
    expect(back.program).toEqual([]);
    expect(back.editing).toEqual({ step: 0 });
    expect(dropped).toEqual(['step A, its effect gone', 'a step']);
    expect(decode(encode(back)).state.program).toEqual([]);
  });

  it('writes code that names every designed effect and step', () => {
    const code = toCode(state());
    expect(code).toMatch(/^createMarquee\(canvas, \{/);
    expect(code).toContain('"hold copy": {');
    expect(code).toContain('{ text: "HI", hex: 0xff9a2e, effect: "hold copy" }');
    expect(code).toContain('{ text: "THERE", hex: 0x6dff5a, effect: "flip", hold: 1500 }');
    expect(code).toContain('colors: [0xff0000, 0x0000ff]');
    expect(code).toContain(
      'rainbow: { mod: "hue-cycle", spread: { by: "column" }, params: { rate: 2, phase: 0.015 } }',
    );
    expect(code).not.toContain('flip: {');
  });

  it('writes an untouched layer as true and leaves out layers that are off', () => {
    const s = state();
    s.layers = {
      sparkle: { mod: 'sparkle', on: true },
      chase: { mod: 'chase', on: false },
    };
    const code = toCode(s);
    expect(code).toContain('layers: { sparkle: true }');
  });

  it('rebuilds every built-in from a link: a copy decodes and stages as the built-in does', () => {
    const s: ComposeState = { effects: {}, program: [], layers: {}, editing: {} };
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

  it('round-trips a step’s face and style, and writes them as code', () => {
    const s = state();
    s.program[0] = { ...(s.program[0] as Step), face: 'slim', style: { reverse: true } };
    s.program[1] = { ...(s.program[1] as Step), style: { proportional: true } };
    const { state: back, dropped } = decode(`#${encode(s)}`);
    expect(dropped).toEqual([]);
    expect(back.program).toEqual(s.program);
    const code = toCode(s);
    expect(code).toContain('face: "slim"');
    expect(code).toContain('style: { reverse: true }');
    expect(code).toContain('style: { proportional: true }');
  });

  it('reads a link written before steps had faces, dropping nothing', () => {
    const old = hashOf({
      effects: {},
      program: [{ text: 'HI', hex: 0xff9a2e, effect: 'hold', hold: 1500 }],
      layers: {},
    });
    const { state: back, dropped } = decode(old);
    expect(dropped).toEqual([]);
    expect(back.program).toEqual([{ text: 'HI', hex: 0xff9a2e, effect: 'hold', hold: 1500 }]);
  });

  it('names a face no built-in has and style switches it does not know', () => {
    const data = JSON.parse(Buffer.from(encode(state()), 'base64url').toString());
    data.program[0].face = 'gothic';
    data.program[1].style = { reverse: true, blink: true, proportional: 'yes' };
    const { state: back, dropped } = decode(hashOf(data));
    expect(back.program[0]?.face).toBeUndefined();
    expect(back.program[1]?.style).toEqual({ reverse: true });
    expect(dropped).toEqual([
      'face in step HI',
      'blink in style in step THERE',
      'proportional in style in step THERE',
    ]);
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
    expect(decode(localStorage.getItem(PREVIOUS) ?? '').state.program[0]?.text).toBe('LINKED');
    expect(localStorage.getItem(DRAFT)).toBe(encode(state()));
  });

  it('keeps no previous draft when the link holds the same composition', () => {
    vi.stubGlobal('localStorage', store());
    save(state());
    open(`#${encode(state())}`);
    expect(hasPrevious()).toBe(false);
  });
});
