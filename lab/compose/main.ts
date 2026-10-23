import '../app.css';
import './compose.css';
import { mount } from '@msb235/blits-panel';
import { createMarquee } from '@/index.js';
import { mountDesigner } from './designer.js';
import type { ComposeState } from './state.js';

const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && !params.has('nopanel')) mount();

const state: ComposeState = {
  effects: {},
  // The preview: the sample message, played with whichever effect is open.
  program: [{ text: 'COMPOSE', hex: 0xff9a2e, effect: 'hold' }],
  layers: {},
  editing: { step: 0 },
};

const sign = createMarquee(document.getElementById('sign') as HTMLCanvasElement, {
  program: () => state.program,
  effects: state.effects,
});

mountDesigner(document.getElementById('designer') as HTMLElement, state, () => {
  const at = state.editing.step ?? 0;
  const step = state.program[at];
  const open = state.editing.effect;
  if (step && open !== undefined) state.program[at] = { ...step, effect: open };
  sign.setEffects(state.effects);
  sign.restart(at);
});
