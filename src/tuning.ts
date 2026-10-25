import type { EffectSpec } from './effects.js';
import { MODULATORS } from './modulators/index.js';
import { MOVES, SLOTS, type Slot } from './moves/index.js';
import type { NumberParam } from './params.js';
import { type Piece, piecesOf } from './pieces.js';

/** An effect's or a scene's hold, an effect's blend and an order's lag, as controls offer them. */
export const HOLD: NumberParam = {
  label: 'hold',
  min: 0,
  max: 12000,
  step: 50,
  value: 0,
  unit: 'ms',
  about:
    'How long the message stands on the sign between coming on and going. Auto uses the standing move’s own length.',
};
export const BLEND: NumberParam = {
  label: 'blend',
  min: 0,
  max: 1000,
  step: 10,
  value: 0,
  unit: 'ms',
  about:
    'How long each part of the effect crossfades into the next, coming on into standing and standing into going. At 0 they cut over at once.',
};
export const LAG: NumberParam = {
  label: 'lag',
  min: 0,
  max: 400,
  step: 1,
  value: 0,
  unit: 'ms',
  about:
    'How long each group of dots waits after the group before it, in the order chosen. At 0 they all go together; higher makes a slower sweep.',
};

/**
 * A setting a scene can tune on an effect. `to` names the settings its value is written to:
 * `enter.0.ms` is the first enter piece's `ms`, `enter.0.lag` that piece's order or spread lag, and
 * `lag` or `blend` the effect's own. Its range, step and default come from the first of them.
 */
export interface EffectParam {
  readonly label: string;
  readonly about: string;
  readonly to: readonly string[];
}

/** A setting `to` names in `effect`: what it is and what the effect sets it to. */
interface Target {
  readonly param: NumberParam;
  readonly value: number;
}

const thingOf = (piece: Piece) => ('mod' in piece ? MODULATORS[piece.mod] : MOVES[piece.move]);
const lagOf = (piece: Piece) => ('mod' in piece ? piece.spread?.lag : piece.order?.lag);

/** The number setting `path` names in `effect`, or undefined for one it does not have. */
export function targetOf(effect: EffectSpec, path: string): Target | undefined {
  if (path === 'lag')
    return effect.order ? { param: LAG, value: effect.order.lag ?? 0 } : undefined;
  if (path === 'blend') return { param: BLEND, value: effect.blend ?? 0 };
  const [slot, index, key] = path.split('.');
  if (!SLOTS.includes(slot as Slot) || key === undefined || !/^\d+$/.test(index ?? '')) return;
  const piece = piecesOf(effect[slot as Slot])[Number(index)];
  if (!piece) return undefined;
  if (key === 'lag') return { param: LAG, value: lagOf(piece) ?? 0 };
  const param = Object.hasOwn(thingOf(piece).params, key) ? thingOf(piece).params[key] : undefined;
  if (!param || !('min' in param)) return undefined;
  const given = piece.params?.[key];
  return { param, value: typeof given === 'number' ? given : param.value };
}

/**
 * What a scene can tune on `effect`: each param it declares whose first target it has, as a number
 * setting defaulting to what the effect sets there, then `blend`, and `lag` for an effect with an
 * order, unless it declares those names itself.
 */
export function tuningOf(effect: EffectSpec): Record<string, NumberParam> {
  const out: Record<string, NumberParam> = {};
  for (const [name, p] of Object.entries(effect.params ?? {})) {
    const first = p.to[0] === undefined ? undefined : targetOf(effect, p.to[0]);
    if (first) out[name] = { ...first.param, label: p.label, about: p.about, value: first.value };
  }
  for (const name of ['blend', 'lag']) {
    const t = targetOf(effect, name);
    if (t && !Object.hasOwn(out, name)) out[name] = { ...t.param, value: t.value };
  }
  return out;
}

const clamp = (p: NumberParam, v: number) => Math.min(p.max, Math.max(p.min, v));

/** `piece` with the setting `key` set to `v`. */
function setOn(piece: Piece, key: string, v: number): Piece {
  if (key === 'lag')
    return 'mod' in piece
      ? { ...piece, spread: { ...(piece.spread ?? { by: 'together' }), lag: v } }
      : { ...piece, order: { ...(piece.order ?? { by: 'together' }), lag: v } };
  return { ...piece, params: { ...piece.params, [key]: v } } as Piece;
}

/** `effect` with `path`'s setting set to `v`, held to that setting's own range. */
function setAt(effect: EffectSpec, path: string, v: number): EffectSpec {
  const target = targetOf(effect, path);
  if (!target) return effect;
  const value = clamp(target.param, v);
  if (path === 'lag')
    return { ...effect, order: { ...(effect.order ?? { by: 'together' }), lag: value } };
  if (path === 'blend') return { ...effect, blend: value };
  const [slot, index, key] = path.split('.') as [Slot, string, string];
  const pieces = [...piecesOf(effect[slot])];
  pieces[Number(index)] = setOn(pieces[Number(index)] as Piece, key, value);
  return { ...effect, [slot]: pieces };
}

/**
 * `effect` as a scene tunes it: each value `given` names one of `tuningOf(effect)` by, held to its
 * range and written to everything it drives. Anything else `given` holds is ignored.
 */
export function tuned(
  effect: EffectSpec,
  given: Readonly<Record<string, number>> | undefined,
): EffectSpec {
  if (!given) return effect;
  const tuning = tuningOf(effect);
  let out = effect;
  for (const [name, v] of Object.entries(given)) {
    const p = Object.hasOwn(tuning, name) ? tuning[name] : undefined;
    if (!p || !Number.isFinite(v)) continue;
    const to = effect.params?.[name]?.to ?? [name];
    for (const path of to) out = setAt(out, path, clamp(p, v));
  }
  return out;
}
