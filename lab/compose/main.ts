import '../app.css';
import './compose.css';
import './program.css';
import './layers.css';
import { mount } from '@msb235/blits-panel';
import { createMarquee } from '@/index.js';
import { h } from './controls.js';
import { mountDefects } from './defects.js';
import { mountDesigner } from './designer.js';
import { layerOf, mountLayers } from './layers.js';
import { mountProgram } from './program.js';
import { encode, toCode } from './share.js';
import { hasPrevious, open, restorePrevious, save } from './storage.js';

const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && !params.has('nopanel')) mount();

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// A link wins over the draft, then is taken out of the address so a reload keeps later edits.
const opened = open(location.hash);
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
const state = opened.state;
const at = () => Math.max(0, Math.min(state.editing.step ?? 0, state.program.length - 1));

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

/** Plays from step `from` (or loops the picked step, soloed) with the effects as they stand. */
const replay = (from = at()) => {
  sign.setEffects(state.effects);
  sign.restart(solo ? 0 : from);
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
  edit: (i) => replay(i),
  select() {
    follow();
    replay();
  },
  solo(on) {
    solo = on;
    replay();
  },
  restart: () => replay(),
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

mountDefects(el('defects'), sign.board, (defects) => sign.setDefects(defects));

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
const share = el('share');
if (opened.unreadable)
  share.append(h('p', 'warning', 'This link could not be read; your draft is unchanged.'));
if (opened.dropped.length)
  share.append(h('p', 'warning', `Left out of the link: ${opened.dropped.join('; ')}.`));
if (hasPrevious()) {
  const back = h('button', 'small', 'restore previous draft');
  back.type = 'button';
  back.title = 'swap back the draft this link replaced; this one is kept as the previous';
  back.addEventListener('click', () => {
    if (restorePrevious()) location.reload();
  });
  share.querySelector('.pane-head')?.append(back);
}
save(state);
