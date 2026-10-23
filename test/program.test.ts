import { mix } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { type EffectSpec, stageEffect } from '@/effects.js';
import { rasterize } from '@/font.js';
import { place } from '@/orders.js';
import { play, type Step } from '@/program.js';

const b = board(80, 7);
const msOf = (step: Step) =>
  stageEffect(
    typeof step.effect === 'string' ? EFFECTS[step.effect as 'hold'] : step.effect,
    { ...place(b, rasterize(step.text)), label: step.text },
    step.hex,
    step.hold,
  ).ms;

const fresh = () => {
  const m = mix<Subject, Pose>(KIT);
  m.sync(0);
  return m;
};
const anyLit = (m: ReturnType<typeof fresh>, t: number) => {
  m.sync(t);
  return b.dots.some((d) => m.probe(d).lit > 0);
};
const stepNames = (m: ReturnType<typeof fresh>) =>
  m
    .marks(0, 100_000)
    .filter((k) => k.mark === 'start')
    .map((k) => k.name);

const LEFT: EffectSpec = {
  name: 'left',
  enter: { move: 'cut-on' },
  active: { move: 'stand' },
  hold: 500,
};
const EMPTY: EffectSpec = { name: 'empty' };

describe('play', () => {
  it('plays steps end to end: step 2 lights nothing before step 1 ends', () => {
    const one: Step = { text: 'I', hex: 0xff9a2e, effect: 'hold' };
    const two: Step = { text: 'I', hex: 0x6dff5a, effect: 'scroll' };
    const m = fresh();
    play(m, b, [one, two]);
    const end = msOf(one);
    const starts = m
      .marks(0, 100_000)
      .filter((k) => k.mark === 'start' && k.name?.startsWith('scroll'));
    expect(new Set(starts.map((k) => k.timestamp))).toEqual(new Set([end]));
    // The scroll enters from the right edge, so just after step 1 the sign is dark.
    expect(anyLit(m, end - 1)).toBe(false);
    expect(anyLit(m, end + 45 * 4)).toBe(true);
  });

  it('resolves done after the last step', async () => {
    const step: Step = { text: 'I', hex: 0xff9a2e, effect: LEFT };
    const m = fresh();
    const program = play(m, b, [step, step]);
    let done = false;
    void program.done.then(() => {
      done = true;
    });
    m.sync(2 * msOf(step) - 10);
    await Promise.resolve();
    expect(done).toBe(false);
    m.sync(2 * msOf(step) + 10);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });

  it('skips a step whose effect has every slot empty without stalling', async () => {
    const m = fresh();
    const step: Step = { text: 'I', hex: 0xff9a2e, effect: LEFT };
    const program = play(m, b, [step, { text: 'I', hex: 0, effect: EMPTY }, step]);
    expect(stepNames(m).filter((n) => n?.startsWith('empty'))).toEqual([]);
    let done = false;
    void program.done.then(() => {
      done = true;
    });
    m.sync(2 * msOf(step) + 10);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });

  it('skips a step that does not fit the board', () => {
    const m = fresh();
    const step: Step = { text: 'I', hex: 0xff9a2e, effect: LEFT };
    play(m, b, [step, { text: 'I', hex: 0, effect: 'tile' }, step]);
    const starts = m.marks(0, 100_000).filter((k) => k.mark === 'start' && k.name === 'left I');
    expect(new Set(starts.map((k) => k.timestamp))).toEqual(new Set([0, msOf(step)]));
    expect(stepNames(m).some((n) => n?.startsWith('tile'))).toBe(false);
  });

  it('names an unknown effect in the error', () => {
    expect(() => play(fresh(), b, [{ text: 'I', hex: 0, effect: 'nope' }])).toThrow(
      'bree: no effect named nope',
    );
  });

  it('finds an effect from the given table before the built-ins', () => {
    const m = fresh();
    play(m, b, [{ text: 'I', hex: 0, effect: 'hold' }], { hold: { ...LEFT, name: 'mine' } });
    expect(stepNames(m)).toContain('mine I');
    expect(stepNames(m).some((n) => n?.startsWith('hold'))).toBe(false);
  });
});
