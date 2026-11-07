// ---
import { createOverlay, TYPES, type TypeName } from '@msb235/blinken';
import { onHold } from './kit';

/** Each real part, how many characters it has, and what it cycles through. */
const PARTS: { type: TypeName; part: string; cells: number; shows: string[] }[] = [
  { type: 'dl3422', part: 'Siemens DL-3422', cells: 4, shows: ['Quip', 'jog?', 'Gyps', 'k=42'] },
  { type: 'dl2416', part: 'DL-2416', cells: 4, shows: ['HOLD', 'OPEN', '24°C', 'GO!'] },
  { type: 'dl3416', part: 'Siemens DL-3416', cells: 4, shows: ['TEST', 'ABCD', '1234', 'EXIT'] },
  { type: 'hdsp2000', part: 'HP HDSP-2000', cells: 4, shows: ['Byte', 'Ready', 'x=7', 'Halt'] },
  {
    type: 'hdsp211x',
    part: 'HP HDSP-211x',
    cells: 8,
    shows: ['Hello, ', 'Channel 9', 'Volume', 'Bass +3'],
  },
  { type: 'dl330m', part: 'Litronix DL-330M', cells: 3, shows: ['8.8.8.', '123', '-4.5', '0.0.0'] },
  {
    type: 'hp50827415',
    part: 'HP 5082-7415',
    cells: 5,
    shows: ['12345', '3.1416', '-273', 'CAFE'],
  },
  { type: 'dl34', part: 'DL-34', cells: 4, shows: ['1984', '12.34', '-56', '7.7.7.7.'] },
];

export default function run(root: HTMLElement) {
  const list = document.createElement('div');
  list.className = 'transitions';
  root.append(list);

  const overlay = createOverlay();
  const rows = PARTS.map((p) => {
    const label = document.createElement('code');
    label.textContent = `${p.type} · ${p.part}`;
    const slot = document.createElement('div');
    const { width, height } = TYPES[p.type].cell;
    const { gap } = TYPES[p.type];
    slot.style.setProperty('--aspect', `${(width + gap) * p.cells} / ${height}`);
    list.append(label, slot);
    return overlay.readout({ type: p.type, cells: p.cells, follow: slot, select: false });
  });

  let n = 0;
  const next = () => {
    for (const [i, r] of rows.entries()) {
      const shows = PARTS[i]?.shows ?? [];
      r.set(shows[n % shows.length] ?? '');
    }
    n++;
  };
  next();

  let timer = 0;
  const stop = onHold(root, (paused) => {
    clearInterval(timer);
    if (!paused) timer = window.setInterval(next, 2000);
  });
  return () => {
    stop();
    clearInterval(timer);
    overlay.destroy();
  };
}
