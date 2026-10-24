import { describe, expect, it } from 'vitest';
import { fromJson, toJson } from '../lab/compose/share.js';
import type { ComposeState } from '../lab/compose/state.js';

const state = (): ComposeState => ({
  effects: {
    'hold copy': {
      name: 'hold copy',
      about: 'Mine.',
      order: { by: 'column', lag: 14 },
      active: [{ move: 'stand' }, { mod: 'invert', params: { shape: 'square' } }],
      hold: 2000,
    },
  },
  program: [
    { text: 'HI', hex: 0xff9a2e, effect: 'hold copy', layers: { rainbow: { on: true } } },
    { text: 'THERE', hex: 0x6dff5a, effect: 'flip', hold: 1500, face: 'slim' },
  ],
  editing: { scene: 1 },
});

describe('saved composition files', () => {
  it('round-trips a composition through its JSON, leaving out what is open', () => {
    const { state: back, dropped, read } = fromJson(toJson(state()));
    expect(read).toBe(true);
    expect(dropped).toEqual([]);
    expect(back.effects).toEqual(state().effects);
    expect(back.program).toEqual(state().program);
    expect(toJson(state())).not.toContain('editing');
  });

  it('writes readable JSON that says what it is', () => {
    const json = toJson(state());
    expect(JSON.parse(json).bree).toBe('composition');
    expect(json).toContain('\n  "program": [');
  });

  it('reads anything that is not a saved composition as unread', () => {
    for (const text of ['', 'not json', '[]', '{"name":"bree","version":"0.0.0"}'])
      expect(fromJson(text).read, text).toBe(false);
  });

  it('reads a hand-edited file forgivingly, naming what it left out', () => {
    const data = JSON.parse(toJson(state()));
    data.program.push({ text: 'X', hex: 0, effect: 'nowhere' });
    const { state: back, dropped, read } = fromJson(JSON.stringify(data));
    expect(read).toBe(true);
    expect(back.program.map((s) => s.text)).toEqual(['HI', 'THERE']);
    expect(dropped).toEqual(['scene X, its effect nowhere']);
  });
});
