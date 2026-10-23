import type { EffectSpec, LayerSpec, Step } from '@/index.js';

/** Everything the compose lab is editing: its effects, the program and layers, and what is open. */
export interface ComposeState {
  effects: Record<string, EffectSpec>;
  program: Step[];
  layers: Record<string, LayerSpec & { on: boolean }>;
  editing: { effect?: string; step?: number };
}

/** `base`, or `base 2`, `base 3`… whichever no effect in `state` is named yet. */
export function freeName(state: ComposeState, base: string): string {
  if (!Object.hasOwn(state.effects, base)) return base;
  for (let n = 2; ; n++) if (!Object.hasOwn(state.effects, `${base} ${n}`)) return `${base} ${n}`;
}
