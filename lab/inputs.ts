// Editable readouts: one type at four heights, each typed into on its own, with the type, cells,
// slant, alignment, face, selection and color varied from the bar. `?backend=` as on readouts.
import './readouts.css';
import './inputs.css';
import {
  type Align,
  createPanel,
  createTicker,
  SELECTIONS,
  type Selection,
  type Surface,
  TYPES,
  type TypeName,
} from '@/index.js';
import { CHOICES, type Choice, drawWith } from './backend.js';
import { labGpu } from './gpu.js';
import { PALETTE } from './palette.js';

const params = new URLSearchParams(location.search);
const choice = (params.get('backend') ?? 'auto') as Choice;
const HEIGHTS = [24, 40, 64, 96];
/** Room above each readout for its caption. */
const CAPTION = 18;
const SPELLING = (Object.keys(TYPES) as TypeName[]).filter((t) => TYPES[t].places);

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
  const slantInput = $<HTMLInputElement>('slant');
  const alignSelect = $<HTMLSelectElement>('align');
  const faceSelect = $<HTMLSelectElement>('face');
  const selectionSelect = $<HTMLSelectElement>('selection');
  for (const name of ['own', ...SELECTIONS]) selectionSelect.add(new Option(name));
  const colorSelect = $<HTMLSelectElement>('color');
  const custom = $<HTMLInputElement>('custom');
  for (const name of ['own', ...Object.keys(PALETTE), 'custom']) colorSelect.add(new Option(name));
  const color = (): number | undefined => {
    const name = colorSelect.value;
    if (name === 'own') return undefined;
    if (name === 'custom') return Number.parseInt(custom.value.slice(1), 16);
    return PALETTE[name as keyof typeof PALETTE];
  };

  const canvas = $<HTMLCanvasElement>('panel');
  const box = canvas.parentElement as HTMLElement;
  box.classList.add('inputs-panel');
  const rowOf = (h: number) => h + CAPTION + 12;
  box.style.setProperty('--rows', '1');
  box.style.setProperty('--row', `${HEIGHTS.reduce((n, h) => n + rowOf(h), 0)}px`);
  const rows = $<HTMLDivElement>('rows');
  rows.style.gridTemplateRows = HEIGHTS.map((h) => `${rowOf(h)}px`).join(' ');
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
  const ticker = createTicker();
  let surface: Surface | null = null;
  const build = () => {
    surface?.destroy();
    const type = typeSelect.value as TypeName;
    const panel = createPanel(canvas, { ...drawWith(choice, handle), ticker });
    surface = panel;
    let y = 0;
    for (const [i, h] of HEIGHTS.entries()) {
      const show = (v: string) => {
        values[i] = v;
        (shown[i] as HTMLElement).textContent = JSON.stringify(v);
      };
      show(values[i] ?? '');
      panel.readout({
        type,
        cells: Math.max(1, Math.min(24, Number(cellsInput.value) || 1)),
        slant: Number(slantInput.value),
        align: alignSelect.value === 'own' ? undefined : (alignSelect.value as Align),
        face: faceSelect.value as 'plate' | 'none',
        selection:
          selectionSelect.value === 'own' ? undefined : (selectionSelect.value as Selection),
        color: color(),
        at: { x: 12, y: y + CAPTION },
        height: h,
        value: values[i],
        edit: true,
        onInput: show,
      });
      y += rowOf(h);
    }
    $('got').textContent = `${panel.backend} · ${type}`;
  };
  build();
  for (const el of [typeSelect, cellsInput, slantInput, alignSelect, faceSelect, selectionSelect])
    el.addEventListener('change', build);
  colorSelect.onchange = () => {
    custom.disabled = colorSelect.value !== 'custom';
    build();
  };
  custom.addEventListener('change', build);
}

run().catch((e) => console.error(e));
