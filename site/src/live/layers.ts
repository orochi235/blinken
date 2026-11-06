// ---
import { createMarquee, LAYERS, type LayerName } from '@msb235/blinken';
import { checkbox, controls, field, held, stage } from './kit';

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 64, rows: 7 });
  const sign = createMarquee(canvas, {
    cols: 64,
    rows: 7,
    program: [{ effect: 'hold', text: 'LAYER CAKE', hex: 0xff9a2e }],
    layers: { sparkle: true },
  });
  const row = controls(root);
  for (const name of Object.keys(LAYERS) as LayerName[]) {
    const box = field(row, name, checkbox(name === 'sparkle'));
    box.addEventListener('change', () => sign.setLayer(name, box.checked));
  }
  return held(root, sign);
}
