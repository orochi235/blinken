// ---
import { createOverlay, TRANSITIONS, type TransitionName, TYPES } from '@msb235/blinken';
import { onHold } from './kit';

const WORDS = ['ARRIVALS', 'BOARDING', 'DELAYED', 'ON TIME', 'GATE 12', 'DEPARTED'];
/** The transitions that step through numbers show numbers; the rest show words. */
const NUMBERS = new Set<TransitionName>(['count', 'roll']);

export default function run(root: HTMLElement) {
  const list = document.createElement('div');
  list.className = 'transitions';
  root.append(list);

  const overlay = createOverlay({ fade: { rise: 30, fall: 60 } });
  const rows = (Object.keys(TRANSITIONS) as TransitionName[]).map((name) => {
    const label = document.createElement('code');
    label.textContent = name;
    const slot = document.createElement('div');
    const numbers = NUMBERS.has(name);
    const type = numbers ? 'seven' : 'sixteen';
    const cells = numbers ? 6 : 8;
    const { width, height } = TYPES[type].cell;
    slot.style.setProperty('--aspect', `${width * cells} / ${height}`);
    list.append(label, slot);
    const readout = overlay.readout({
      type,
      cells,
      follow: slot,
      select: false,
      align: numbers ? 'right' : 'left',
      color: numbers ? 0xffb020 : 0x4fd8ff,
      transition: name,
    });
    return { readout, numbers };
  });

  let n = 0;
  const next = () => {
    const word = WORDS[n % WORDS.length] ?? '';
    const number = Math.floor(10_000 + ((n * 7919) % 90_000));
    for (const r of rows) r.readout.set(r.numbers ? number : word);
    n++;
  };
  next();

  let timer = 0;
  const stop = onHold(root, (paused) => {
    clearInterval(timer);
    if (!paused) timer = window.setInterval(next, 2400);
  });
  return () => {
    stop();
    clearInterval(timer);
    overlay.destroy();
  };
}
