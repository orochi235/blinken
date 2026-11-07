// Editable readouts: one type at four heights, each typed into on its own, with the type, cells,
// slant, alignment, face, selection and color varied from the bar. `?backend=` as on readouts.
import './readouts.css';
import './inputs.css';
import {
  type Align,
  createPanel,
  createTicker,
  type Readout,
  SELECTIONS,
  type Selection,
  type Surface,
  TYPES,
  type TypeName,
} from '@/index.js';
import { CHOICES, type Choice, drawWith } from './backend.js';
import { labGpu } from './gpu.js';
import { colorPicker } from './palette.js';
import { adoptShell } from './shell/adopt.js';

adoptShell('blinken inputs');

const params = new URLSearchParams(location.search);
const choice = (params.get('backend') ?? 'auto') as Choice;
const HEIGHTS = [24, 40, 64, 96];
/**
 * The most cells the bar offers; the library has no limit. Past this, the 96 px readout's canvas
 * on a 2× display runs over WebGPU's default 8192-pixel texture.
 */
const MOST_CELLS = 64;
/** Room above each readout for its caption. */
const CAPTION = 18;
const SPELLING = (Object.keys(TYPES) as TypeName[]).filter((t) => TYPES[t].spell && t !== 'half');

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function run() {
  const handle = await labGpu;
  const backendSelect = $<HTMLSelectElement>('backend');
  for (const c of CHOICES) backendSelect.add(new Option(c, c, c === choice, c === choice));
  backendSelect.onchange = () => {
    params.set('backend', backendSelect.value);
    location.search = params.toString();
  };
  const typeSelect = $<HTMLSelectElement>('type');
  for (const t of SPELLING) typeSelect.add(new Option(t, t, t === 'fourteen', t === 'fourteen'));
  const cellsInput = $<HTMLInputElement>('cells');
  const linesInput = $<HTMLInputElement>('lines');
  const wrapInput = $<HTMLInputElement>('wrap');
  const copySelect = $<HTMLSelectElement>('copy');
  const slantInput = $<HTMLInputElement>('slant');
  const alignSelect = $<HTMLSelectElement>('align');
  const faceSelect = $<HTMLSelectElement>('face');
  const selectionSelect = $<HTMLSelectElement>('selection');
  for (const name of ['own', ...SELECTIONS]) selectionSelect.add(new Option(name));
  const colorSelect = $<HTMLSelectElement>('color');
  const custom = $<HTMLInputElement>('custom');
  // A color recolors the readouts in place; going back to their own builds them afresh.
  const color = colorPicker(colorSelect, custom, () => {
    const hex = color();
    if (hex === undefined) build();
    else for (const r of readouts) r.color(hex);
  });

  const canvas = $<HTMLCanvasElement>('panel');
  const box = canvas.parentElement as HTMLElement;
  box.classList.add('inputs-panel');
  box.style.setProperty('--rows', '1');
  const rows = $<HTMLDivElement>('rows');
  const shown = HEIGHTS.map((h) => {
    const row = document.createElement('div');
    row.className = 'input-row';
    const label = document.createElement('span');
    label.textContent = `${h} px`;
    const value = document.createElement('span');
    value.className = 'input-value';
    row.append(label, value);
    rows.append(row);
    return value;
  });

  /** What each readout holds, kept as the bar rebuilds them. */
  const values = HEIGHTS.map(() => 'HELLO');
  let readouts: Readout[] = [];
  const look = () =>
    selectionSelect.value === 'own' ? undefined : (selectionSelect.value as Selection);
  const ticker = createTicker();
  let surface: Surface | null = null;
  /** The settings the panel was last built with, so a field's change on blur doesn't rebuild it. */
  let built = '';
  const build = () => {
    const settings = JSON.stringify(
      [
        typeSelect,
        cellsInput,
        linesInput,
        slantInput,
        alignSelect,
        faceSelect,
        colorSelect,
        custom,
        copySelect,
      ]
        .map((el) => el.value)
        .concat(String(wrapInput.checked)),
    );
    if (settings === built) return;
    built = settings;
    surface?.destroy();
    const type = typeSelect.value as TypeName;
    const panel = createPanel(canvas, { ...drawWith(choice, handle), ticker });
    surface = panel;
    const lines = Math.max(1, Math.min(6, Number(linesInput.value) || 1));
    const tall = (h: number) => h * lines + (h * (lines - 1)) / 4;
    const rowAt = (h: number) => tall(h) + CAPTION + 12;
    box.style.setProperty('--row', `${HEIGHTS.reduce((n, h) => n + rowAt(h), 0)}px`);
    rows.style.gridTemplateRows = HEIGHTS.map((h) => `${rowAt(h)}px`).join(' ');
    readouts = [];
    const cells = Math.max(1, Math.min(MOST_CELLS, Number(cellsInput.value) || 1));
    let y = 0;
    for (const [i, h] of HEIGHTS.entries()) {
      const show = (v: string) => {
        values[i] = v;
        (shown[i] as HTMLElement).textContent = JSON.stringify(v);
      };
      show(values[i] ?? '');
      const r = panel.readout({
        type,
        cells,
        slant: Number(slantInput.value),
        align: alignSelect.value === 'own' ? undefined : (alignSelect.value as Align),
        face: faceSelect.value as 'plate' | 'none',
        selection: look(),
        color: color(),
        at: { x: 12, y: y + CAPTION },
        height: tall(h),
        lines,
        wrap: wrapInput.checked,
        copy: copySelect.value as 'shown' | 'value',
        value: values[i],
        edit: true,
        onInput: show,
      });
      readouts.push(r);
      y += rowAt(h);
    }
    // As wide as the widest readout once it's drawn, so a long one scrolls the pane rather than
    // being cut off at its edge.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const left = box.getBoundingClientRect().left;
        const right = Math.max(
          0,
          ...[...box.querySelectorAll<HTMLElement>('.blinken-text-readout')].map(
            (g) => g.getBoundingClientRect().right - left,
          ),
        );
        box.style.setProperty('--width', `${Math.ceil(right + 12)}px`);
      }),
    );
    $('got').textContent = `${panel.backend} · ${type}`;
  };
  build();
  for (const el of [
    typeSelect,
    cellsInput,
    linesInput,
    wrapInput,
    slantInput,
    alignSelect,
    faceSelect,
    copySelect,
  ])
    el.addEventListener('change', build);
  // A new look restyles the readouts in place, so what is selected or typed at stays.
  selectionSelect.addEventListener('change', () => {
    for (const r of readouts) r.setSelection(look());
  });
}

run().catch((e) => console.error(e));
