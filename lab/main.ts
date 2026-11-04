import './app.css';
import { mount } from '@msb235/blits-panel';
import { createMarquee, EFFECTS, LAYERS, type LayerName, type Scene } from '@/index.js';
import { decode } from './compose/share.js';
import { demo } from './demo.js';
import { labGpu } from './gpu.js';

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const canvas = el<HTMLCanvasElement>('sign');
const message = el<HTMLInputElement>('message');
const hue = el<HTMLSelectElement>('hue');
const rate = el<HTMLInputElement>('rate');
const rateOut = el<HTMLOutputElement>('rate-out');
const cost = el<HTMLOutputElement>('cost');
const colsIn = el<HTMLInputElement>('cols');
const rowsIn = el<HTMLInputElement>('rows');
const sizeForm = el<HTMLFormElement>('size');

const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && !params.has('nopanel')) mount();

/** `?cols=&rows=` size the sign, for stretching it to benchmark; `?nodraw` times the mix alone. */
const whole = (key: string, fallback: number, most: number) => {
  const v = Math.floor(Number(params.get(key)));
  return Number.isFinite(v) && v >= 1 ? Math.min(v, most) : fallback;
};

const userHex = () => Number.parseInt(hue.value, 16);
/** A composer link's `#…` plays its composition in place of the demo; the message and color then have nothing to drive. */
const shared = location.hash.length > 1 ? decode(location.hash) : null;
const composition = shared?.read ? shared.state : null;
// A pasted link changes only the hash, which reloads nothing on its own.
addEventListener('hashchange', () => location.reload());
for (const input of [message, hue]) input.disabled = composition !== null;

/** `?show=flip` loops that one effect on the message, for looking at it alone. */
const only = params.get('show');
const program = (): Scene[] =>
  composition
    ? composition.program
    : only !== null && Object.hasOwn(EFFECTS, only)
      ? [{ effect: only, text: message.value || ' ', hex: userHex() }]
      : demo(message.value || ' ', userHex());

// Each layer's checkbox shares its name.
const boxes = (Object.keys(LAYERS) as LayerName[]).map((name) => ({
  name,
  box: el<HTMLInputElement>(name),
}));
// A link's layers play in its scenes; the sign's own start off.
if (composition) for (const { box } of boxes) box.checked = false;

let frames = 0;
let shownAt = performance.now();
const handle = await labGpu;
const sign = createMarquee(canvas, {
  gpu: handle,
  cols: whole('cols', 80, 4000),
  rows: whole('rows', 7, 2000),
  program,
  effects: composition?.effects,
  layers: Object.fromEntries(boxes.map(({ name, box }) => [name, box.checked])),
  color: userHex(),
  draw: !params.has('nodraw'),
  onFrame({ mixMs, drawMs }) {
    frames++;
    const now = performance.now();
    if (now - shownAt <= 250) return;
    const fps = (frames * 1000) / (now - shownAt);
    frames = 0;
    shownAt = now;
    const b = sign.board;
    const lights = b.dots.length + b.bulbs.length;
    const subjects = b.dots.length + b.cells.length;
    cost.value = `${lights} lights, ${subjects} subjects · ${fps.toFixed(0).padStart(3)} fps · mix ${mixMs.toFixed(2).padStart(6)} ms · draw ${drawMs.toFixed(2).padStart(6)} ms`;
  },
});

colsIn.value = String(sign.board.cols);
rowsIn.value = String(sign.board.rows);
sizeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  params.set('cols', colsIn.value);
  params.set('rows', rowsIn.value);
  location.search = params.toString();
});
for (const { name, box } of boxes)
  box.addEventListener('change', () => sign.setLayer(name, box.checked));
// The visitor's message first plays at the program's second scene, so a change replays from there.
const replay = () => sign.restart(only === null ? 1 : 0);
message.addEventListener('change', replay);
hue.addEventListener('change', () => {
  sign.setColor(userHex());
  replay();
});
rate.addEventListener('input', () => {
  sign.ramp(Number(rate.value), 200);
  rateOut.value = `${Number(rate.value).toFixed(2)}×`;
});
