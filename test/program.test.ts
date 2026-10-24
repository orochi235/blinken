import { mix } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { type EffectSpec, stageEffect } from '@/effects.js';
import type { Face } from '@/faces.js';
import { rasterize } from '@/font.js';
import { place } from '@/orders.js';
import { play, type Scene } from '@/program.js';

const b = board(80, 7);
/** A face taller than the board's lines, so a scene in it never fits. */
const tall: Face = { name: 'tall', rows: 9, width: 5, glyph: () => Array(9).fill('#####') };
const msOf = (scene: Scene) =>
  stageEffect(
    typeof scene.effect === 'string' ? EFFECTS[scene.effect as 'hold'] : scene.effect,
    { ...place(b, rasterize(scene.text)), label: scene.text },
    scene.hex,
    scene.hold,
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
const sceneNames = (m: ReturnType<typeof fresh>) =>
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
  it('plays scenes end to end: scene 2 lights nothing before scene 1 ends', () => {
    const one: Scene = { text: 'I', hex: 0xff9a2e, effect: 'hold' };
    const two: Scene = { text: 'I', hex: 0x6dff5a, effect: 'scroll' };
    const m = fresh();
    play(m, b, [one, two]);
    const end = msOf(one);
    const starts = m
      .marks(0, 100_000)
      .filter((k) => k.mark === 'start' && k.name?.startsWith('scroll'));
    expect(new Set(starts.map((k) => k.timestamp))).toEqual(new Set([end]));
    // The scroll enters from the right edge, so just after scene 1 the sign is dark.
    expect(anyLit(m, end - 1)).toBe(false);
    expect(anyLit(m, end + 45 * 4)).toBe(true);
  });

  it('resolves done after the last scene', async () => {
    const scene: Scene = { text: 'I', hex: 0xff9a2e, effect: LEFT };
    const m = fresh();
    const program = play(m, b, [scene, scene]);
    let done = false;
    void program.done.then(() => {
      done = true;
    });
    m.sync(2 * msOf(scene) - 10);
    await Promise.resolve();
    expect(done).toBe(false);
    m.sync(2 * msOf(scene) + 10);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });

  it('skips a scene whose effect has every slot empty without stalling', async () => {
    const m = fresh();
    const scene: Scene = { text: 'I', hex: 0xff9a2e, effect: LEFT };
    const program = play(m, b, [scene, { text: 'I', hex: 0, effect: EMPTY }, scene]);
    expect(sceneNames(m).filter((n) => n?.startsWith('empty'))).toEqual([]);
    let done = false;
    void program.done.then(() => {
      done = true;
    });
    m.sync(2 * msOf(scene) + 10);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });

  it('skips a scene that does not fit the board', () => {
    const m = fresh();
    const scene: Scene = { text: 'I', hex: 0xff9a2e, effect: LEFT };
    play(m, b, [scene, { text: 'I', hex: 0, effect: 'hold', face: tall }, scene]);
    const starts = m.marks(0, 100_000).filter((k) => k.mark === 'start' && k.name === 'left I');
    expect(new Set(starts.map((k) => k.timestamp))).toEqual(new Set([0, msOf(scene)]));
    expect(sceneNames(m).some((n) => n?.startsWith('hold'))).toBe(false);
  });

  it('resolves done after a sync when no scene fits', async () => {
    const m = fresh();
    const program = play(m, b, [{ text: 'I', hex: 0, effect: 'hold', face: tall }]);
    let done = false;
    void program.done.then(() => {
      done = true;
    });
    m.sync(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });

  it('names an unknown effect in the error', () => {
    expect(() => play(fresh(), b, [{ text: 'I', hex: 0, effect: 'nope' }])).toThrow(
      'bree: no effect named nope',
    );
  });

  it('throws for a bad scene before cueing anything', () => {
    const m = fresh();
    const good: Scene = { text: 'I', hex: 0, effect: LEFT };
    expect(() => play(m, b, [good, { text: 'I', hex: 0, effect: 'constructor' }])).toThrow(
      'bree: no effect named constructor',
    );
    expect(m.marks(0, 100_000)).toEqual([]);
  });

  it('finds an effect from the given table before the built-ins', () => {
    const m = fresh();
    play(m, b, [{ text: 'I', hex: 0, effect: 'hold' }], { hold: { ...LEFT, name: 'mine' } });
    expect(sceneNames(m)).toContain('mine I');
    expect(sceneNames(m).some((n) => n?.startsWith('hold'))).toBe(false);
  });
});
