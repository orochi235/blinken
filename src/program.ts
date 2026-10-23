import type { Handle, Mix, Signal } from '@msb235/blits';
import type { Board, Pose, Subject } from './board.js';
import { EFFECTS, type LayerSpec } from './builtins.js';
import { cueEffect, type EffectSpec, stageEffect } from './effects.js';
import { rasterize } from './font.js';
import { MODULATORS } from './modulators/index.js';
import { MOVES } from './moves/index.js';
import { place, placeText, rankOf } from './orders.js';
import { values } from './params.js';
import { piecesOf, TOGETHER } from './pieces.js';

/** One message in a program: its text and color, the effect it plays with, and a hold overriding the effect's. */
export interface Step {
  readonly text: string;
  readonly hex: number;
  readonly effect: string | EffectSpec;
  readonly hold?: number;
}

/** A step's effect, looked up in `effects` before the built-ins. */
export function effectOf(
  step: Step,
  effects: Readonly<Record<string, EffectSpec>> = {},
): EffectSpec {
  if (typeof step.effect !== 'string') return step.effect;
  const name = step.effect;
  if (Object.hasOwn(effects, name)) return effects[name] as EffectSpec;
  if (Object.hasOwn(EFFECTS, name)) return EFFECTS[name as keyof typeof EFFECTS];
  throw new Error(`bree: no effect named ${name}`);
}

/** Whether the board has room for every move an effect uses. */
export function fits(b: Board, effect: EffectSpec): boolean {
  return [effect.enter, effect.active, effect.exit].every((slot) =>
    piecesOf(slot).every((piece) => !('move' in piece) || (MOVES[piece.move].fits?.(b) ?? true)),
  );
}

/**
 * Cues one pass of a program under an owner of its own, each step that fits the board on an owner
 * of its own where the one before it ends, and returns the program owner, done after the last step.
 */
export function play(
  m: Mix<Subject, Pose>,
  b: Board,
  steps: readonly Step[],
  effects?: Readonly<Record<string, EffectSpec>>,
): Handle<Subject> {
  // Staged in full first, so a bad step throws before anything is cued.
  const staged = steps.flatMap((step) => {
    const effect = effectOf(step, effects);
    if (!fits(b, effect)) return [];
    const s = stageEffect(effect, placeText(b, step.text), step.hex, step.hold);
    return s.ms > 0 ? [{ staged: s, name: `${effect.name} ${step.text}` }] : [];
  });
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
