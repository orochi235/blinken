// ---
import { createOverlay } from '@msb235/blinken';

export default function run(root: HTMLElement) {
  const form = document.createElement('div');
  form.className = 'inputs';
  const echo = document.createElement('output');
  echo.className = 'inputs-echo';
  root.append(form, echo);

  /** A labeled slot in the form, as wide as `cells` cells of `rows` rows; a readout follows it. */
  const slot = (label: string, cells: number, rows = 1) => {
    const name = document.createElement('span');
    name.textContent = label;
    const box = document.createElement('div');
    box.className = 'inputs-slot';
    box.style.setProperty('--cells', String(cells));
    box.style.setProperty('--rows', String(rows));
    form.append(name, box);
    return box;
  };

  const values: Record<string, string> = {};
  const heard = (name: string) => (value: string) => {
    values[name] = value;
    echo.textContent = Object.entries(values)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('   ');
  };

  const overlay = createOverlay();
  const freq = overlay.readout({
    type: 'seven',
    cells: 5,
    value: '101.5',
    edit: true,
    label: 'Frequency',
    follow: slot('FREQ', 5),
    field: { inputmode: 'decimal' },
    onInput: heard('freq'),
    // ↑ and ↓ step it by a tenth.
    onKeyDown(e) {
      const step = e.key === 'ArrowUp' ? 0.1 : e.key === 'ArrowDown' ? -0.1 : 0;
      if (!step) return;
      e.preventDefault();
      const next = (Number.parseFloat(String(freq.value)) || 0) + step;
      freq.set(next.toFixed(1));
      heard('freq')(next.toFixed(1));
    },
  });
  overlay.readout({
    type: 'sixteen',
    cells: 8,
    value: 'KB6NU',
    edit: true,
    label: 'Call sign',
    color: 0x6dff5a,
    follow: slot('CALL', 8),
    onInput: heard('call'),
  });
  overlay.readout({
    type: 'sixteen',
    cells: 12,
    lines: 2,
    value: 'GOING ON AIR',
    edit: true,
    label: 'Message',
    color: 0xff4030,
    follow: slot('MSG', 12, 2),
    onInput: heard('msg'),
  });
  echo.textContent = 'Click a readout and type.';

  return () => overlay.destroy();
}
