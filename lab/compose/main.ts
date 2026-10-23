import '../app.css';
import './compose.css';
import './program.css';
import './layers.css';
import { mount } from '@msb235/blits-panel';
import { createMarquee } from '@/index.js';
import { h } from './controls.js';
import { mountDesigner } from './designer.js';
import { layerOf, mountLayers } from './layers.js';
import { mountProgram } from './program.js';
import { decode, defaultState, encode, load, save, toCode } from './share.js';

const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && !params.has('nopanel')) mount();

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// A link wins over the draft, then is taken out of the address so a reload keeps later edits.
const linked = location.hash.length > 1 ? decode(location.hash) : null;
if (linked) history.replaceState(null, '', location.pathname + location.search);
const state = linked?.state ?? load() ?? defaultState();
const at = () => Math.min(state.editing.step ?? 0, state.program.length - 1);

let solo = false;
const sign = createMarquee(el<HTMLCanvasElement>('sign'), {
  program: () => {
    const step = state.program[at()];
    return solo && step ? [step] : state.program;
  },
  effects: state.effects,
});
for (const [name, layer] of Object.entries(state.layers))
  sign.setLayer(name, layer.on, layer.params);

/** Plays from the step being edited (or loops it, soloed) with the effects as they stand. */
const replay = () => {
  sign.setEffects(state.effects);
  sign.restart(solo ? 0 : at());
  save(state);
};

/** Opens the picked step's effect in the designer when it is one of yours. */
const follow = () => {
  const step = state.program[at()];
  const name = typeof step?.effect === 'string' ? step.effect : undefined;
  state.editing.effect =
    name !== undefined && Object.hasOwn(state.effects, name) ? name : undefined;
  designer.render();
};

const program = mountProgram(el('program'), state, {
  edit: replay,
  select() {
    follow();
    replay();
  },
  solo(on) {
    solo = on;
    replay();
  },
  restart: replay,
});

const designer = mountDesigner(el('designer'), state, sign.board, () => {
  const i = at();
  const step = state.program[i];
  const open = state.editing.effect;
  if (step && open !== undefined) state.program[i] = { ...step, effect: open };
  program.render();
  replay();
});
follow();

mountLayers(el('layers'), state, (name) => {
  const layer = layerOf(state, name);
  sign.setLayer(name, layer.on, layer.params);
  save(state);
});

// Export: the clipboard may refuse (a headless browser, an insecure origin), so each also shows.
const linkOut = el<HTMLInputElement>('link');
const codeOut = el<HTMLTextAreaElement>('code');
const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});
el('copy-link').addEventListener('click', () => {
  linkOut.value = `${location.origin}${location.pathname}${location.search}#${encode(state)}`;
  linkOut.select();
  copy(linkOut.value);
});
el('copy-code').addEventListener('click', () => {
  codeOut.value = toCode(state);
  codeOut.classList.add('shown');
  copy(codeOut.value);
});
if (linked?.dropped.length)
  el('share').append(h('p', 'warning', `Left out of the link: ${linked.dropped.join('; ')}.`));
save(state);
