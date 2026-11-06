// ---
import { createMarquee } from '@msb235/blinken';
import { held, stage } from './kit';

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 48, rows: 7 });
  const sign = createMarquee(canvas, {
    cols: 48,
    rows: 7,
    program: [
      { effect: 'hold', text: 'NOW SHOWING', hex: 0xff4030 },
      { effect: 'flip', text: 'TONIGHT', hex: 0xff9a2e },
      { effect: 'scroll', text: 'SEE YOU THERE', hex: 0x6dff5a },
    ],
    border: { bulbs: 'chase' },
  });
  return held(root, sign);
}
