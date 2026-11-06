// ---
import { createPanel } from '@msb235/blinken';
import { onHold } from './kit';

export default function run(root: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'panel-canvas';
  root.append(canvas);
  const panel = createPanel(canvas);
  const clock = panel.readout({ type: 'seven', cells: 4, at: { x: 24, y: 20 }, height: 64 });
  const count = panel.readout({ type: 'nixie', cells: 4, at: { x: 24, y: 104 }, height: 72 });
  const word = panel.readout({ type: 'sixteen', cells: 6, at: { x: 260, y: 20 }, height: 64 });
  const words = ['OPEN', 'CLOSED', 'BACK', 'SOON'];
  let n = 0;
  const tick = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    clock.set(`${hh}${now.getSeconds() % 2 ? ':' : ''}${mm}`);
    count.set(n % 10_000);
    word.set(words[Math.floor(n / 2) % words.length] ?? '');
    n++;
  };
  tick();
  let timer = 0;
  const stop = onHold(root, (paused) => {
    clearInterval(timer);
    if (!paused) timer = window.setInterval(tick, 1000);
  });
  return () => {
    stop();
    clearInterval(timer);
    panel.destroy();
  };
}
