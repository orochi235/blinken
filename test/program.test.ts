import { mix } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { EFFECTS } from '@/builtins.js';
import { type EffectSpec, stageEffect } from '@/effects.js';
import { rasterize } from '@/font.js';
import { place, placeText } from '@/orders.js';
import { layerOf, play, type Scene, stageProgram } from '@/program.js';

const b = board(80, 7);
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

  it('plays the layers of a scene across that scene alone, and still finishes', async () => {
    const lit: Scene = { text: 'I', hex: 0xff9a2e, effect: LEFT };
    const rainbow: Scene = { ...lit, layers: { rainbow: { params: { arc: 360 } } } };
    const m = fresh();
    const program = play(m, b, [rainbow, lit]);
    const dot = b.dots[0] as Subject;
    const hueAt = (t: number) => {
      m.sync(t);
      return m.probe(dot).hue ?? 0;
    };
    const ms = msOf(lit);
    expect([ms * 0.25, ms * 0.5, ms * 0.75].map(hueAt).some((h) => h !== 0)).toBe(true);
    expect(hueAt(ms * 1.5)).toBe(0);
    let done = false;
    void program.done.then(() => {
      done = true;
    });
    m.sync(2 * ms + 10);
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });

  it('places a scene’s layer against its message, so a spread by letter follows the letters', () => {
    const b = board(40, 7);
    const [scene] = stageProgram(b, [
      {
        text: 'AB',
        hex: 0xff9a2e,
        effect: 'hold',
        layers: { swept: { mod: 'hue-cycle', spread: { by: 'letter' }, params: { phase: 0.25 } } },
      },
    ]);
    const layer = scene?.layers[0];
    const at = placeText(b, 'AB');
    const hueAt = (x: number) =>
      layer?.patch.at(0.1, b.dots.find((d) => d.x === x && d.y === 3) as never, {} as never).hue;
    expect(hueAt(at.left + 1)).not.toBe(hueAt(at.left + 7));
  });

  it('keeps the settings of a layer that is off, and plays nothing', () => {
    expect(layerOf('rainbow', { on: false, params: { arc: 90 } })).toBeNull();
    expect(layerOf('rainbow', true)?.mod).toBe('hue-cycle');
    expect(layerOf('rainbow', { params: { arc: 90 } })?.params).toMatchObject({
      arc: 90,
      rate: 0.4,
    });
    expect(() => layerOf('nope', true)).toThrow('no layer named nope');
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

  it('resolves done after a sync when no scene plays', async () => {
    const m = fresh();
    const program = play(m, b, [{ text: 'I', hex: 0, effect: EMPTY }]);
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
