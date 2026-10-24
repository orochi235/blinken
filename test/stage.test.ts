import { type ArcVoice, type Mix, mix, oklab } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { cueEffect, type EffectSpec, stageEffect } from '@/effects.js';
import { rasterize } from '@/font.js';
import { MOVES, type MoveName } from '@/moves/index.js';
import { groupsOf, place } from '@/orders.js';
import { values } from '@/params.js';

const b = board(40, 7);
const at = { ...place(b, rasterize('ABC')), label: 'ABC' };
const HEX = 0xff9a2e;
const FOLD = 300;
const TUMBLE = 1200;

const flip: EffectSpec = {
  name: 'flip',
  order: { by: 'letter', lag: 90 },
  enter: { move: 'unfold' },
  active: { move: 'tumble' },
  exit: { move: 'fold' },
};

const shown = () =>
  b.dots.map((d) => (d.kind === 'dot' && d.row >= 0 && at.text.lit(d.x - at.left, d.row) ? 1 : 0));

/** A mix at 0 with the effect cued under an owner there. */
function cued(effect: EffectSpec, hold?: number): Mix<Subject, Pose> {
  const m = mix<Subject, Pose>(KIT);
  m.sync(0);
  cueEffect(m, m.owns({ name: 'scene' }), stageEffect(effect, at, HEX, hold), effect.name);
  return m;
}

const litNow = (m: Mix<Subject, Pose>, t: number) => {
  m.sync(t);
  return b.dots.map((d) => m.probe(d).lit);
};

const voicesOf = (part: unknown) =>
  (Array.isArray(part) ? part : [part]) as ArcVoice<Subject, Pose>[];

describe('stageEffect', () => {
  it('stages flip-shaped data as one arc per letter, a lag apart', () => {
    const { arcs } = stageEffect(flip, at, HEX);
    expect(arcs.map((a) => a.start)).toEqual([0, 90, 180]);
    const groups = groupsOf({ by: 'letter' }, at);
    arcs.forEach((a, i) => {
      for (const v of voicesOf(a.spec.enter)) expect(v.subjects).toEqual(groups[i]);
    });
  });

  it('lets letter 0 tumble while letter 2 is still unfolding', () => {
    const m = cued(flip);
    const ins = m.marks(0, 10_000).filter((k) => k.mark === 'in');
    const inOf = (name: string) => ins.find((k) => k.name === name)?.timestamp;
    expect(inOf('flip 0')).toBe(FOLD);
    expect(inOf('flip 2')).toBe(180 + FOLD);
    const t = FOLD + 10;
    expect(inOf('flip 0')).toBeLessThan(t);
    expect(inOf('flip 2')).toBeGreaterThan(t);

    // Drawn: letter 0 stands flat 10 ms into its tumble; letter 2 is still squashed mid-unfold.
    const lit = litNow(m, t);
    const groups = groupsOf({ by: 'letter' }, at);
    const want = shown();
    const index = new Map(b.dots.map((d, i) => [d, i]));
    const of = (g: number, from: number[]) =>
      (groups[g] ?? []).map((d) => from[index.get(d) as number]);
    expect(of(0, lit)).toEqual(of(0, want));
    expect(of(2, lit)).not.toEqual(of(2, want));
    const unfold = MOVES.unfold.patch(at, values(MOVES.unfold));
    const phase = (t - 180) / FOLD;
    expect(of(2, lit)).toEqual((groups[2] ?? []).map((d) => unfold.at(phase, d, {} as never).lit));
  });

  it('gives ms as the last arc start plus enter, hold and exit', () => {
    expect(stageEffect(flip, at, HEX).ms).toBe(180 + FOLD + TUMBLE + FOLD);
    expect(stageEffect({ ...flip, hold: 500 }, at, HEX).ms).toBe(180 + FOLD + 500 + FOLD);
    const plain = stageEffect({ name: 'p', enter: { move: 'unfold' } }, at, HEX);
    expect(plain.arcs).toHaveLength(1);
    expect(plain.ms).toBe(FOLD);

    const m = cued(flip);
    const end = m.marks(0, 10_000).filter((k) => k.mark === 'end' && k.name?.startsWith('flip'));
    expect(Math.max(...end.map((k) => k.timestamp))).toBe(stageEffect(flip, at, HEX).ms);
  });

  it('overrides the hold from the scene', () => {
    const staged = stageEffect({ ...flip, hold: 500 }, at, HEX, 800);
    expect(staged.ms).toBe(180 + FOLD + 800 + FOLD);
    for (const a of staged.arcs) expect(a.spec.hold).toBe(800);
    const m = cued({ ...flip, hold: 500 }, 800);
    const coast = m.marks(0, 10_000).find((k) => k.mark === 'coast' && k.name === 'flip 0');
    expect(coast?.timestamp).toBe(FOLD + 800);
  });

  it('holds a scroll-across for its crossing with no hold given', () => {
    const across = MOVES['scroll-across'];
    const staged = stageEffect({ name: 's', active: { move: 'scroll-across' } }, at, HEX);
    expect(staged.ms).toBe(across.patch(at, values(across)).duration);
  });

  it('warns when two pieces in one slot set tint', () => {
    const two: EffectSpec = {
      name: 'two',
      enter: { move: 'cut-on' },
      active: [{ move: 'stand' }, { mod: 'palette' }, { mod: 'two-color' }],
    };
    expect(stageEffect(two, at, HEX).warnings).toEqual([
      { slot: 'active', text: 'two pieces in active set tint' },
    ]);
    const one: EffectSpec = { name: 'one', active: [{ move: 'stand' }, { mod: 'palette' }] };
    expect(stageEffect(one, at, HEX).warnings).toEqual([]);
  });

  it('passes on each piece’s warnings once', () => {
    const wide = { ...place(board(20, 7), rasterize('HELLO WORLD')), label: 'HELLO WORLD' };
    const { warnings } = stageEffect(flip, wide, HEX);
    expect(warnings).toEqual([
      { slot: 'enter', piece: 0, text: 'unfold clips HELLO WORLD' },
      { slot: 'active', piece: 0, text: 'tumble clips HELLO WORLD' },
      { slot: 'exit', piece: 0, text: 'fold clips HELLO WORLD' },
    ]);
    const layered = stageEffect(
      { ...flip, active: [{ mod: 'pulse' }, { move: 'tumble' }] },
      wide,
      HEX,
    );
    expect(layered.warnings[1]).toEqual({
      slot: 'active',
      piece: 1,
      text: 'tumble clips HELLO WORLD',
    });
  });

  it('round-trips an effect through JSON unchanged', () => {
    const rich: EffectSpec = {
      ...flip,
      about: 'letters flip',
      active: [
        { move: 'tumble', params: { turns: 3 } },
        { mod: 'pulse', spread: { by: 'letter' } },
      ],
      hold: 900,
      blend: 40,
    };
    const back = JSON.parse(JSON.stringify(rich)) as EffectSpec;
    expect(back).toEqual(rich);
    expect(stageEffect(back, at, HEX).ms).toBe(stageEffect(rich, at, HEX).ms);
  });
});

describe('what an effect draws', () => {
  const enters = (Object.keys(MOVES) as MoveName[]).filter((n) => MOVES[n].slot === 'enter');
  for (const name of enters) {
    it(`${name} leaves the message standing once its enter ends`, () => {
      const m = cued({ name, enter: { move: name } }, 400);
      const enter = stageEffect({ name, enter: { move: name } }, at, HEX).ms;
      expect(litNow(m, enter + 200)).toEqual(shown());
    });
  }

  it('stands the message after the enter and leaves the sign dark after the exit', () => {
    const effect: EffectSpec = {
      name: 'hold',
      enter: { move: 'cut-on', order: { by: 'column', lag: 10 } },
      active: { move: 'stand' },
      exit: { move: 'fold' },
      hold: 600,
    };
    const { ms } = stageEffect(effect, at, HEX);
    const m = cued(effect);
    expect(litNow(m, 39 * 10 + 1 + 300)).toEqual(shown());
    expect(litNow(m, ms + 1).every((v) => v === 0)).toBe(true);
  });

  it('tints the dots the scene color', () => {
    const m = cued({ name: 'c', enter: { move: 'cut-on' }, active: { move: 'stand' } }, 500);
    m.sync(300);
    const tint = m.probe(b.dots[0] as Subject).tint;
    const want = oklab(HEX);
    for (let i = 0; i < 3; i++) expect(tint[i]).toBeCloseTo(want[i] as number, 5);
  });

  it('plays a tint modulator at weight 3 over the scene color', () => {
    const staged = stageEffect(
      { name: 'p', active: [{ move: 'stand' }, { mod: 'palette' }] },
      at,
      HEX,
      500,
    );
    const voices = voicesOf(staged.arcs[0]?.spec.active);
    const palette = voices.find((v) => v.patch.writes.includes('tint') && v.weight !== undefined);
    expect(palette?.weight).toBe(3);
    expect(voices.filter((v) => v.patch.writes.includes('tint'))).toHaveLength(2);
  });

  it('lets a modulator in the enter last its own length', () => {
    const effect: EffectSpec = { name: 'f', enter: [{ move: 'cut-on' }, { mod: 'flare' }] };
    const flare = 1500;
    expect(stageEffect(effect, at, HEX).ms).toBe(flare);
    const m = cued(effect, 0);
    const done = m.marks(0, 10_000).find((k) => k.mark === 'in' && k.name === 'f');
    expect(done?.timestamp).toBe(flare);
    // With its default sweep of half the pass, every dot peaks a quarter of the way in.
    m.sync(flare / 4);
    expect(m.probe(b.dots[0] as Subject).glow).toBeCloseTo(2);
  });

  it('plays a border-cell modulator on one arc of its own, across every group', () => {
    const effect: EffectSpec = { ...flip, active: [{ move: 'tumble' }, { mod: 'chase' }] };
    const staged = stageEffect(effect, at, HEX);
    const onCells = staged.arcs.filter((a) =>
      voicesOf(a.spec.active).some((v) => v.subjects === b.cells),
    );
    expect(staged.arcs).toHaveLength(4);
    expect(onCells).toHaveLength(1);
    expect(onCells[0]?.start).toBe(0);
    expect(onCells[0]?.spec.hold).toBe(180 + TUMBLE);
    expect(staged.ms).toBe(180 + FOLD + TUMBLE + FOLD);
    // Still lit while the last letter tumbles, past where letter 0's active ends.
    const m = cued(effect);
    m.sync(180 + FOLD + TUMBLE - 10);
    expect(m.probe(b.cells[0] as Subject).lit).toBeGreaterThan(0);
    const out = m.marks(0, 10_000).filter((k) => k.mark === 'out' && k.name?.startsWith('flip'));
    expect(Math.max(...out.map((k) => k.timestamp))).toBe(180 + FOLD + TUMBLE);
  });
});
