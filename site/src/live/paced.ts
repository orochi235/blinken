// ---
import { createMarquee } from '@msb235/blinken';
import { controls, held, stage } from './kit';

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 40, rows: 7 });
  const sign = createMarquee(canvas, {
    cols: 40,
    rows: 7,
    program: [{ effect: 'type', text: 'HELLO THERE', hex: 0xff9a2e, params: { pace: 'input' } }],
  });
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Type the next letter';
  next.addEventListener('click', () => sign.step());
  controls(root).append(next);
  return held(root, sign);
}
