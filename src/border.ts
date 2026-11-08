import { type Handle, type Mix, type Patch, patch } from '@msb235/blits';
import { type Board, everyOf, type Pose, type Subject } from './board.js';
import { BULB, chase, NONE } from './modulators/chase.js';
import { f32, onGpu, shader } from './modulators/shader.js';
import { cueLayer } from './program.js';

/**
 * How the border's bulbs light: dark, all lit, or in a theater chase stepping every `beat` ms with
 * the bulbs between the lit ones at `dim`.
 */
export interface Border {
  readonly bulbs: 'unlit' | 'lit' | 'chase';
  readonly beat?: number;
  readonly dim?: number;
}

const STEADY = patch<Subject, Pose>(
  1000,
  (_phase, s) => (s.kind === 'cell' ? { lit: 1, tint: BULB } : {}),
  { writes: ['lit', 'tint'] },
);

const STEADY_SHADER = shader({
  params: [],
  wgsl: `out.lit = 0.0;
out.tint = array<f32, 4>(0.0, 0.0, 0.0, 0.0);
if (subject.cell > 0.5) {
  out.lit = 1.0;
  out.tint = array<f32, 4>(${BULB.map(f32).join(', ')});
}`,
  at: (_ph, s) => (s.kind === 'cell' ? { lit: 1, tint: BULB } : { lit: 0, tint: NONE }),
  writes: ['lit', 'tint'],
})(1000, {});

/** Every bulb lit, in the chase's warm white: a shader on every subject for the gpu engine. */
export function steadyOf(
  b: Board,
  gpu: boolean,
): { patch: Patch<Subject, Pose>; subjects: readonly Subject[] } {
  return gpu
    ? { patch: STEADY_SHADER, subjects: everyOf(b) }
    : { patch: STEADY, subjects: b.cells };
}

/** A sign's border, which lights its bulbs as asked until told otherwise. */
export interface BorderVoice {
  set(border: Border): void;
}

/** Lights `b`'s bulbs on `m` as `border` asks; a board with no bulbs ignores it. */
export function cueBorder(m: Mix<Subject, Pose>, b: Board, border: Border): BorderVoice {
  let voice: Handle<Subject> | null = null;
  const set = (next: Border) => {
    voice?.fade({ over: 0 });
    voice = null;
    if (b.bulbs.length === 0 || next.bulbs === 'unlit') return;
    if (next.bulbs === 'lit') {
      voice = m.cue({ name: 'border lit', ...steadyOf(b, onGpu(m)), loop: true });
      return;
    }
    const params = {
      beat: next.beat ?? chase.params.beat.value,
      dim: next.dim ?? chase.params.dim.value,
    };
    voice = cueLayer(m, b, { mod: 'chase', params }, 1);
  };
  set(border);
  return { set };
}
