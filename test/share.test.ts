import { describe, expect, it } from 'vitest';
import { decode, encode, toCode } from '../lab/compose/share.js';
import type { ComposeState } from '../lab/compose/state.js';

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

  it('clamps every number setting to its range', () => {
    const data = JSON.parse(Buffer.from(encode(state()), 'base64url').toString());
    data.effects['hold copy'].exit = [{ mod: 'dim', params: { sweep: 1, ms: -5, depth: 0.5 } }];
    data.effects['hold copy'].hold = -100;
    data.program[1].hold = 1e9;
    const { state: back } = decode(hashOf(data));
    const exit = back.effects['hold copy']?.exit as readonly { params: Record<string, number> }[];
    expect(exit[0]?.params).toEqual({ sweep: 0.95, ms: 100, depth: 0.5 });
    expect(back.effects['hold copy']?.hold).toBe(0);
    expect(back.program[1]?.hold).toBe(12000);
  });

  it('reads a broken link as the demo program, saying so', () => {
    const { state: back, dropped } = decode('#not-json!');
    expect(back.program.length).toBeGreaterThan(1);
    expect(back.program[0]?.text).toBe('BLITS');
    expect(dropped).toEqual(['the link could not be read']);
  });

  it('writes code that names every designed effect and step', () => {
    const code = toCode(state());
    expect(code).toMatch(/^createMarquee\(canvas, \{/);
    expect(code).toContain("'hold copy': {");
    expect(code).toContain("{ text: 'HI', hex: 0xff9a2e, effect: 'hold copy' }");
    expect(code).toContain("{ text: 'THERE', hex: 0x6dff5a, effect: 'flip', hold: 1500 }");
    expect(code).toContain('colors: [0xff0000, 0x0000ff]');
    expect(code).toContain(
      "rainbow: { mod: 'hue-cycle', spread: { by: 'column' }, params: { rate: 2, phase: 0.015 } }",
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
});
