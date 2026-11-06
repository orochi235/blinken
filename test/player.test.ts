import { describe, expect, it } from 'vitest';
import { AMBER } from '@/index.js';
import { embedOf } from '../lab/compose/embed.js';
import { encode, playable, toJson } from '../lab/compose/share.js';
import { HARDWARE } from '../lab/compose/sign-hardware.js';
import type { ComposeState } from '../lab/compose/state.js';
import { attributeSource, childSource, resolve } from '../player/config.js';

const state: ComposeState = {
  effects: {},
  program: [{ effect: 'scroll', text: 'OPEN LATE', hex: AMBER }],
  editing: {},
};
const link = encode(state);
const attrs = (a: Record<string, string>) => attributeSource((name) => a[name] ?? null);

describe('the player', () => {
  it('reads a program from a link, the part after its #, or a composition file', () => {
    for (const text of [`https://x.test/play#${link}`, link, `#${link}`, toJson(state)]) {
      const { decoded } = resolve([{ program: text }]);
      expect(decoded?.read).toBe(true);
      expect(decoded?.state.program[0]?.text).toBe('OPEN LATE');
    }
  });

  it('plays nothing it was not given, and says when a program does not read', () => {
    expect(resolve([{}]).decoded).toBeNull();
    expect(resolve([{ program: 'not a program!' }]).decoded?.read).toBe(false);
  });

  it('lets the page override what was compiled in: attributes over the JSON inside, over baked', () => {
    const other = encode({ ...state, program: [{ effect: 'scroll', text: 'CLOSED', hex: AMBER }] });
    const baked = { program: link, hardware: { size: { cols: 30, rows: 9 }, fade: { fall: 400 } } };
    const file = `${toJson(state).trimEnd().slice(0, -1)}, "hardware": { "size": { "rows": 14 } } }`;
    const { decoded, hardware } = resolve([
      baked,
      childSource(file),
      attrs({ program: other, cols: '50', hardware: '{"ghost":{"row":0.1}}' }),
    ]);
    expect(decoded?.state.program[0]?.text).toBe('CLOSED');
    expect(hardware.size).toEqual({ cols: 50, rows: 14, grid: 'square' });
    expect(hardware.fade.fall).toBe(400);
    expect(hardware.ghost.row).toBe(0.1);
  });

  it('reads the housing as an attribute, and keeps one it does not know to dark', () => {
    expect(resolve([attrs({ housing: 'clear' })]).hardware.case.housing).toBe('clear');
    expect(resolve([attrs({ housing: 'glass' })]).hardware.case.housing).toBe('dark');
  });

  it('keeps hardware it cannot use to the defaults', () => {
    const { hardware } = resolve([attrs({ cols: 'wide', grid: 'spiral', hardware: '{oops' })]);
    expect(hardware).toEqual(HARDWARE);
  });
});

describe('the compose page embed', () => {
  it('plays the composition on its hardware, naming only what differs from the defaults', () => {
    const hardware = { ...HARDWARE, size: { cols: 40, rows: 7, grid: 'hex' } };
    const html = embedOf(state, { ...hardware, fade: { ...HARDWARE.fade, fall: 500 } });
    expect(html).toContain('<script src="blinken-player.js"></script>');
    expect(html).toContain(`program="${encode(playable(state))}"`);
    expect(html).toContain('cols="40" rows="7" grid="hex"');
    expect(html).toContain('hardware="{&quot;fade&quot;:{&quot;fall&quot;:500}}"');
    expect(embedOf(state, HARDWARE)).not.toContain('hardware=');
    expect(embedOf(state, HARDWARE)).not.toContain('housing=');
    const clear = embedOf(state, { ...HARDWARE, case: { housing: 'clear' } });
    expect(clear).toContain('housing="clear"');
    expect(clear).not.toContain('hardware=');
  });
});
