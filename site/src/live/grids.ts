// ---
import { createMarquee } from '@msb235/blinken';
import { held, stage } from './kit';

export default function run(root: HTMLElement) {
  const hex = createMarquee(stage(root, { cols: 40, rows: 7, grid: 'hex' }), {
    cols: 40,
    rows: 7,
    grid: 'hex',
    program: [{ effect: 'scroll', text: 'SIX NEIGHBORS EACH', hex: 0x6dff5a }],
  });
  const tri = createMarquee(stage(root, { cols: 80, rows: 7, grid: 'triangles' }), {
    cols: 80,
    rows: 7,
    grid: 'triangles',
    program: [{ effect: 'tile', text: 'TRIANGLES', hex: 0xff9a2e }],
  });
  return held(root, hex, () => tri.destroy());
}
