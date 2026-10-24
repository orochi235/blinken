import type { Handle, Mix, Signal } from '@msb235/blits';
import type { Board, Pose, Subject } from './board.js';
import { EFFECTS, type LayerSpec } from './builtins.js';
import { cueEffect, type EffectSpec, type StagedEffect, stageEffect } from './effects.js';
import { type Look, rasterize } from './font.js';
import { MODULATORS } from './modulators/index.js';
import { place, placeText, rankOf } from './orders.js';
import { values } from './params.js';
import { TOGETHER } from './pieces.js';

/**
 * One message in a program: its text and color, the effect it plays with, a hold overriding the
 * effect's, and the face and style it is drawn in (default the standard face, plain).
 */
export interface Scene extends Look {
  readonly text: string;
  readonly hex: number;
  readonly effect: string | EffectSpec;
  readonly hold?: number;
}

/** A scene's effect, looked up in `effects` before the built-ins. */
export function effectOf(
  scene: Scene,
  effects: Readonly<Record<string, EffectSpec>> = {},
): EffectSpec {
  if (typeof scene.effect !== 'string') return scene.effect;
  const name = scene.effect;
  if (Object.hasOwn(effects, name)) return effects[name] as EffectSpec;
  if (Object.hasOwn(EFFECTS, name)) return EFFECTS[name as keyof typeof EFFECTS];
  throw new Error(`bree: no effect named ${name}`);
}

/** A scene of a program staged to play: which scene it is, and what it plays. */
export interface StagedScene {
  /** Its index in the scenes it was staged from. */
  readonly scene: number;
  readonly staged: StagedEffect;
  readonly name: string;
}

/**
 * Stages each scene of a program that fits the board and plays for some time, in order: a scene
 * whose face is taller than the board's lines is left out. Throws on a scene naming no effect or face, before anything is cued.
 */
export function stageProgram(
  b: Board,
  scenes: readonly Scene[],
  effects?: Readonly<Record<string, EffectSpec>>,
): StagedScene[] {
  return scenes.flatMap((scene, i) => {
    const effect = effectOf(scene, effects);
    const at = placeText(b, scene.text, scene);
    if (at.text.rows > b.line) return [];
    const s = stageEffect(effect, at, scene.hex, scene.hold);
    return s.ms > 0 ? [{ scene: i, staged: s, name: `${effect.name} ${scene.text}` }] : [];
  });
}

/**
 * Cues staged scenes under a program owner of its own, each on an owner of its own where the one
 * before it ends, and returns the program owner, done after the last scene.
 */
export function cueProgram(m: Mix<Subject, Pose>, staged: readonly StagedScene[]): Handle<Subject> {
  const program = m.owns({ name: 'program' });
  let start = 0;
  for (const { staged: s, name } of staged) {
    cueEffect(m, m.owns({ owner: program, start, name }), s, name);
    start += s.ms;
  }
  // An owner holding nothing would stay until faded.
  if (start === 0) program.fade({ over: 0 });
  return program;
}

/**
 * Cues one pass of a program under an owner of its own, each scene that fits the board on an owner
 * of its own where the one before it ends, and returns the program owner, done after the last scene.
 */
export function play(
  m: Mix<Subject, Pose>,
  b: Board,
  scenes: readonly Scene[],
  effects?: Readonly<Record<string, EffectSpec>>,
): Handle<Subject> {
  return cueProgram(m, stageProgram(b, scenes, effects));
}

/** Cues a layer's modulator looping on its subjects for good, weighted by `weight` (a `level`, say). */
export function cueLayer(
  m: Mix<Subject, Pose>,
  b: Board,
  layer: LayerSpec,
  weight: number | Signal<Subject>,
): Handle<Subject> {
  const mod = MODULATORS[layer.mod];
  const at = place(b, rasterize(''));
  return m.cue({
    name: layer.mod,
    patch: mod.patch(at, values(mod, layer.params as never), rankOf(layer.spread ?? TOGETHER, at)),
    subjects: mod.on === 'cells' ? b.cells : b.dots,
    loop: true,
    weight,
  });
}
