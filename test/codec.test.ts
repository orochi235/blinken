import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { EFFECTS, LAYERS } from '@/builtins.js';
import { stageEffect } from '@/effects.js';
import { FACE_NAMES } from '@/faces.js';
import { MODULATORS } from '@/modulators/index.js';
import { MOVES } from '@/moves/index.js';
import { ORDERS, placeText } from '@/orders.js';
import { BitReader, BitWriter, widthOf } from '../lab/compose/bits.js';
import { pack, unpack, VERSION } from '../lab/compose/codec.js';
import { HEX, sceneOf } from '../lab/compose/readers.js';
import { decode, encode, playable, shareOf } from '../lab/compose/share.js';
import { BLEND, type ComposeState, HOLD, LAG } from '../lab/compose/state.js';

const AMBER = 0xff9a2e;

/** The composition behind the 1,905-character player link that prompted packing. */
const copies = (): ComposeState => ({
  effects: {
    'flip copy': {
      name: 'flip copy',
      about: EFFECTS.flip.about,
      order: { by: 'letter', lag: 90 },
      enter: [{ move: 'unfold' }],
      active: [{ move: 'scroll-across' }],
      exit: [{ move: 'fold' }],
      hold: 3000,
    },
    'roll copy': {
      name: 'roll copy',
      about: EFFECTS.roll.about,
      order: { by: 'center' },
      enter: [{ move: 'reel-in', order: { by: 'letter', lag: 140 } }],
      active: [{ move: 'stand' }],
      exit: [{ move: 'roll-away' }],
      hold: 2500,
      blend: 410,
    },
    mine: {
      name: 'mine',
      about: 'My own words.',
      active: [
        { move: 'tumble', params: { turns: 3 } },
        { mod: 'flash', spread: { by: 'random', seed: -7 }, params: { from: 1 / 3 } },
      ],
    },
  },
  program: [
    {
      text: 'TONIGHT',
      hex: AMBER,
      effect: 'hold',
      layers: {
        sparkle: { on: false, params: { rate: 0.022 } },
        rainbow: { on: true, params: { rate: 0.6 } },
      },
    },
    { text: 'YOU', hex: 0x6dff5a, effect: 'roll copy', hold: 1234.5 },
    { text: 'ÜBER 🎉', hex: AMBER, effect: 'mine', face: 'slim', style: { reverse: true } },
  ],
  editing: {},
});

const without = ({ editing: _, ...rest }: ComposeState) => rest;

describe('bits', () => {
  it('reads back what it wrote, across byte boundaries', () => {
    const w = new BitWriter();
    w.uint(5, 3);
    w.count(0);
    w.count(1_000_003);
    w.int(-42);
    w.float(Math.PI);
    w.text('héllo');
    w.flag(true);
    const r = new BitReader(w.done());
    expect([r.uint(3), r.count(), r.count(), r.int(), r.float(), r.text(), r.flag()]).toEqual([
      5,
      0,
      1_000_003,
      -42,
      Math.PI,
      'héllo',
      true,
    ]);
    expect(() => r.uint(8)).toThrow(RangeError);
  });
});

describe('packed links', () => {
  it('round-trips a composition, including numbers off their steps', () => {
    const { state: back, dropped, read } = decode(encode(copies()));
    expect(read).toBe(true);
    expect(dropped).toEqual([]);
    expect(without(back)).toEqual(without(copies()));
  });

  it('writes no setting that is at its default', () => {
    const s = copies();
    const spec = s.effects.mine as ComposeState['effects'][string];
    const turns = (MOVES.tumble.params.turns as { value: number }).value;
    s.effects.mine = { ...spec, active: [{ move: 'tumble', params: { turns } }] };
    const t = copies();
    t.effects.mine = { ...spec, active: [{ move: 'tumble' }] };
    expect(encode(s)).toBe(encode(t));
  });

  it('round-trips every built-in, a copy staging as the built-in does', () => {
    const s: ComposeState = { effects: {}, program: [], editing: {} };
    for (const [name, spec] of Object.entries(EFFECTS))
      s.effects[`${name} copy`] = { ...spec, name: `${name} copy` };
    const { state: back } = decode(encode(s));
    const at = placeText(board(80, 7), 'HELLO');
    for (const [name, spec] of Object.entries(EFFECTS)) {
      const got = back.effects[`${name} copy`] as typeof spec;
      expect(got.about, name).toBe(spec.about);
      expect(JSON.stringify(stageEffect(got, at, AMBER).arcs), name).toBe(
        JSON.stringify(stageEffect(spec, at, AMBER).arcs),
      );
    }
  });

  it('round-trips a random composition of every move, modulator, order and face', () => {
    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)] as T;
    for (let trial = 0; trial < 50; trial++) {
      const s: ComposeState = { effects: {}, program: [], editing: {} };
      for (let e = 0; e < 3; e++) {
        const spec: Record<string, unknown> = { name: `e${e}` };
        for (const slot of ['enter', 'active', 'exit'] as const) {
          const moves = Object.entries(MOVES).filter(([, m]) => m.slot === slot);
          const [move, m] = pick(moves);
          const params = Object.fromEntries(
            Object.entries(m.params).flatMap(([k, p]) =>
              'min' in p && rand() < 0.5 ? [[k, p.min + Math.round(rand() * 10) * p.step]] : [],
            ),
          );
          const [mod] = pick(Object.entries(MODULATORS));
          spec[slot] = [
            { move, order: { by: pick(ORDERS), lag: Math.round(rand() * 400) }, params },
            { mod, spread: { by: pick(ORDERS), seed: Math.round(rand() * 1e6) } },
          ];
        }
        spec.hold = Math.round(rand() * 240) * 50;
        s.effects[`e${e}`] = spec as unknown as ComposeState['effects'][string];
      }
      for (let i = 0; i < 4; i++)
        s.program.push({
          text: `S${i}`,
          hex: Math.floor(rand() * 0xffffff),
          effect: rand() < 0.5 ? `e${i % 3}` : pick(Object.keys(EFFECTS)),
          face: pick(FACE_NAMES),
        });
      const { state: back, dropped } = decode(encode(s));
      expect(dropped, `trial ${trial}`).toEqual([]);
      expect(decode(encode(back)).state, `trial ${trial}`).toEqual(back);
      expect(back.program, `trial ${trial}`).toEqual(s.program);
    }
  });

  it('reads a link of another version, or a cut-off one, as unread', () => {
    const bytes = pack(shareOf(copies()));
    const other = Uint8Array.from(bytes);
    other[0] = VERSION + 1;
    const hash = (b: Uint8Array) => Buffer.from(b).toString('base64url');
    expect(decode(hash(other)).read).toBe(false);
    expect(decode(hash(bytes.slice(0, bytes.length >> 1))).read).toBe(false);
    expect(() => unpack(bytes.slice(0, 3))).toThrow(RangeError);
  });

  it('gives the player only what it plays, in a link a fraction of the full one', () => {
    const play = playable(copies());
    expect(Object.keys(play.effects)).toEqual(['1', '2']);
    expect(play.program.map((s) => s.effect)).toEqual(['hold', '1', '2']);
    expect(play.effects['1']?.about).toBeUndefined();
    expect(Object.keys(play.program[0]?.layers ?? {})).toEqual(['rainbow']);
    const at = placeText(board(80, 7), 'YOU');
    const back = decode(encode(play)).state;
    expect(JSON.stringify(stageEffect(back.effects['1'] as never, at, AMBER).arcs)).toBe(
      JSON.stringify(stageEffect(copies().effects['roll copy'] as never, at, AMBER).arcs),
    );
    const json = Buffer.from(JSON.stringify(shareOf(play))).toString('base64url');
    expect(encode(play).length).toBeLessThan(json.length / 4);
  });

  it('opens a version 2 link, dropping the chase layer that moved to the sign', () => {
    const w = new BitWriter();
    w.uint(2, 8);
    w.count(0);
    w.count(1);
    w.text('A');
    w.flag(false);
    w.flag(false);
    w.uint(Object.keys(EFFECTS).indexOf('hold'), widthOf(Object.keys(EFFECTS).length));
    for (let k = 0; k < 4; k++) w.flag(false);
    // Sparkle absent; chase and invert there, on, at their built-in settings; rainbow absent.
    w.flag(false);
    w.flag(true);
    w.flag(true);
    for (const _ of Object.keys(MODULATORS.chase.params)) w.flag(false);
    w.flag(false);
    w.flag(true);
    w.flag(true);
    for (const _ of Object.keys(MODULATORS.invert.params)) w.flag(false);
    const { state, read } = decode(Buffer.from(w.done()).toString('base64url'));
    expect(read).toBe(true);
    expect(state.program.map((s) => s.layers)).toEqual([{ invert: { on: true } }]);
  });

  it('opens a version 3 link as monospace unless it set proportional', () => {
    const w = new BitWriter();
    w.uint(3, 8);
    w.count(0);
    w.count(2);
    for (const proportional of [false, true]) {
      w.text('A');
      w.flag(false);
      w.flag(false);
      w.uint(Object.keys(EFFECTS).indexOf('hold'), widthOf(Object.keys(EFFECTS).length));
      w.flag(false);
      w.flag(false);
      w.flag(false);
      w.flag(proportional);
      for (const _ of Object.keys(LAYERS)) w.flag(false);
    }
    const { state, read } = decode(Buffer.from(w.done()).toString('base64url'));
    expect(read).toBe(true);
    expect(state.program.map((s) => s.style)).toEqual([{ monospace: true }, undefined]);
  });

  it('opens a version 1 link with its layers on every scene', () => {
    const w = new BitWriter();
    w.uint(1, 8);
    // Sparkle and chase absent; rainbow there, on, at its built-in settings.
    w.flag(false);
    w.flag(false);
    w.flag(true);
    w.flag(true);
    for (const _ of Object.keys(MODULATORS['hue-cycle'].params)) w.flag(false);
    w.count(0);
    w.count(2);
    for (const text of ['A', 'B']) {
      w.text(text);
      w.flag(false);
      w.flag(false);
      w.uint(Object.keys(EFFECTS).indexOf('hold'), widthOf(Object.keys(EFFECTS).length));
      for (let k = 0; k < 4; k++) w.flag(false);
    }
    const { state, read } = decode(Buffer.from(w.done()).toString('base64url'));
    expect(read).toBe(true);
    expect(state.program.map((s) => s.layers)).toEqual([
      { rainbow: { on: true } },
      { rainbow: { on: true } },
    ]);
  });

  it('is at VERSION for the registries and ranges it was written against', () => {
    const range = (p: object) =>
      JSON.stringify(p, ['min', 'max', 'step', 'choices', 'value', 'colors']);
    const layout = JSON.stringify({
      effects: Object.keys(EFFECTS),
      moves: Object.entries(MOVES).map(([n, m]) => [n, m.slot, range(m.params)]),
      mods: Object.entries(MODULATORS).map(([n, m]) => [n, range(m.params)]),
      layers: LAYERS,
      orders: ORDERS,
      faces: FACE_NAMES,
      numbers: [HOLD, BLEND, LAG, HEX].map(range),
    });
    const digest = createHash('sha256').update(layout).digest('hex').slice(0, 12);
    // A change here changes what existing links decode to: bump VERSION, then update the digest.
    expect({ VERSION, digest }).toEqual({ VERSION: 4, digest: '75147cfac27a' });
  });
});

describe('sceneOf', () => {
  it('reads a Not Jam face by the name it had before 2026-10-24', () => {
    const dropped: string[] = [];
    const scene = sceneOf({ text: 'HI', effect: 'scroll', face: 'notjam-serif' }, {}, dropped);
    expect({ face: scene?.face, dropped }).toEqual({ face: 'nj serif', dropped: [] });
  });
});
