// Every readout type live on one panel, and a scrolling grid of cards each holding a readout drawn
// by one overlay. `?backend=` picks what draws them: auto, webgpu, webgl or 2d.
import './readouts.css';
import {
  createOverlay,
  createPanel,
  createTicker,
  type Readout,
  type ReadoutOptions,
  SELECTIONS,
  type Selection,
  type Surface,
  TYPES,
  type TypeName,
} from '@/index.js';
import { CHOICES, type Choice, drawWith } from './backend.js';
import { labGpu } from './gpu.js';
import { colorPicker } from './palette.js';

const params = new URLSearchParams(location.search);
const choice = (params.get('backend') ?? 'auto') as Choice;
const ROW = 64;
const HEIGHT = 40;

/** A value per tick: the time, a counter, a level, or the typed text. */
type Feed = (t: { now: Date; n: number; text: string }) => string | number;
const pad = (v: number, n = 2) => String(v).padStart(n, '0');
const hhmm = ({ now }: { now: Date }) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;
const hhmmss = ({ now }: { now: Date }) =>
  `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

const SHOWN: readonly { type: TypeName; cells: number; feed: Feed; half?: boolean }[] = [
  { type: 'seven', cells: 4, feed: hhmm },
  { type: 'seven', cells: 3, feed: ({ n }) => ((n % 3998) - 1999).toString(), half: true },
  { type: 'eight', cells: 4, feed: ({ n }) => n % 10000 },
  { type: 'nine', cells: 4, feed: () => 'Z7Z7' },
  { type: 'fourteen', cells: 8, feed: ({ text }) => text.toUpperCase() },
  { type: 'sixteen', cells: 8, feed: ({ text }) => text.toUpperCase() },
  { type: 'twentytwo', cells: 8, feed: ({ text }) => text },
  { type: 'matrix', cells: 6, feed: ({ text }) => text },
  { type: 'nixie', cells: 6, feed: hhmmss },
  { type: 'cistercian', cells: 2, feed: ({ n }) => n % 100000000 },
  { type: 'maya', cells: 3, feed: ({ n }) => n % 8000 },
  { type: 'kaktovik', cells: 3, feed: ({ n }) => n % 8000 },
  { type: 'rods', cells: 4, feed: ({ n }) => n % 10000 },
  { type: 'braille', cells: 6, feed: ({ text }) => text.toLowerCase() },
  { type: 'ogham', cells: 6, feed: ({ text }) => text.toUpperCase() },
  { type: 'morse', cells: 4, feed: ({ text }) => text.toUpperCase() },
  { type: 'semaphore', cells: 4, feed: ({ text }) => text.toUpperCase() },
  { type: 'dice', cells: 4, feed: ({ n }) => n % 10000 },
  { type: 'tally', cells: 4, feed: ({ n }) => n % 20 },
  { type: 'bcd', cells: 6, feed: hhmmss },
  { type: 'bargraph', cells: 12, feed: ({ n }) => 0.5 + 0.5 * Math.sin(n / 10) },
  { type: 'triangles', cells: 6, feed: ({ text }) => text },
  { type: 'triangles-fine', cells: 5, feed: ({ text }) => text },
];

const CARD_TYPES: readonly TypeName[] = ['seven', 'nixie', 'fourteen', 'cistercian', 'dice'];
const CARDS = 60;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function run() {
  const handle = await labGpu;
  const backendSelect = $<HTMLSelectElement>('backend');
  for (const c of CHOICES) backendSelect.add(new Option(c, c, c === choice, c === choice));
  backendSelect.onchange = () => {
    params.set('backend', backendSelect.value);
    location.search = params.toString();
  };
  const faceSelect = $<HTMLSelectElement>('face');
  const selectionSelect = $<HTMLSelectElement>('selection');
  for (const name of ['own', ...SELECTIONS]) selectionSelect.add(new Option(name));
  /** The color every readout is built in; undefined leaves each its type's own. */
  const picked = colorPicker($<HTMLSelectElement>('color'), $<HTMLInputElement>('custom'), () =>
    recolor(),
  );
  const text = $<HTMLInputElement>('text');
  const panelCanvas = $<HTMLCanvasElement>('panel');
  const panelBox = panelCanvas.parentElement as HTMLElement;
  panelBox.style.setProperty('--rows', String(Math.ceil(SHOWN.length / 2)));
  panelBox.style.setProperty('--row', `${ROW}px`);
  const labels = $<HTMLDivElement>('labels');
  for (const s of SHOWN) {
    const l = document.createElement('div');
    l.className = 'label';
    l.textContent = s.half ? `${s.type} + ½` : s.type;
    labels.append(l);
  }
  const cards = $<HTMLElement>('cards');
  const slots = Array.from({ length: CARDS }, (_, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    const label = document.createElement('div');
    label.className = 'caption';
    label.textContent = `card ${i + 1} · ${CARD_TYPES[i % CARD_TYPES.length]}`;
    const slot = document.createElement('div');
    slot.className = 'slot';
    card.append(label, slot);
    cards.append(card);
    return slot;
  });

  const ticker = createTicker();
  const draw = { ...drawWith(choice, handle), ticker };
  let surfaces: Surface[] = [];
  let shown: { r: Readout; feed: Feed }[] = [];
  const build = () => {
    for (const s of surfaces) s.destroy();
    const face = faceSelect.value as 'plate' | 'none';
    const color = picked();
    const selection =
      selectionSelect.value === 'own' ? undefined : (selectionSelect.value as Selection);
    const panel = createPanel(panelCanvas, draw);
    const overlay = createOverlay(draw);
    surfaces = [panel, overlay];
    const width = panelCanvas.clientWidth / 2;
    shown = [
      ...SHOWN.map((s, i) => {
        const o: ReadoutOptions = {
          type: s.type,
          cells: s.cells,
          face,
          color,
          selection,
          half: s.half,
          at: { x: (i % 2) * width + 12, y: Math.floor(i / 2) * ROW + 18 },
          height: HEIGHT,
        };
        return { r: panel.readout(o), feed: s.feed };
      }),
      ...slots.map((slot, i) => {
        const type = CARD_TYPES[i % CARD_TYPES.length] as TypeName;
        const feed: Feed = type === 'fourteen' ? () => `CARD${i + 1}` : ({ n }) => n + i * 37;
        const cells = type === 'cistercian' ? 1 : type === 'fourteen' ? 6 : 4;
        return { r: overlay.readout({ type, cells, face, color, selection, follow: slot }), feed };
      }),
    ];
    $('got').textContent = `${panel.backend} · ${Object.keys(TYPES).length} types`;
  };
  build();
  faceSelect.onchange = build;
  selectionSelect.onchange = build;
  // A color recolors the readouts in place; going back to their own builds them afresh.
  const recolor = () => {
    const hex = picked();
    if (hex === undefined) build();
    else for (const { r } of shown) r.color(hex);
  };
  let n = 0;
  const tick = () => {
    const at = { now: new Date(), n, text: text.value };
    for (const { r, feed } of shown) r.set(feed(at));
    n++;
  };
  tick();
  setInterval(tick, 100);
}

run().catch((e) => console.error(e));
