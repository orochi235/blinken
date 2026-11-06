// ---
import { createMarquee } from '@msb235/blinken';
import { held, stage } from './kit';

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 64, rows: 9 });
  const sign = createMarquee(canvas, {
    cols: 64,
    rows: 9,
    program: [
      { effect: 'hold', text: 'NOW SHOWING', hex: 0xff4030 },
      { effect: 'flip', text: 'BLINKEN', hex: 0xff9a2e },
      { effect: 'scroll', text: 'AN LED SIGN ON A CANVAS', hex: 0x6dff5a },
      { effect: 'matris', text: 'NO ASSETS', hex: 0x6dff5a },
      { effect: 'bounce', text: 'TONIGHT ONLY', hex: 0xff9a2e },
      { effect: 'tile', text: 'OPEN LATE', hex: 0xff4030, layers: { rainbow: true } },
    ],
    border: { bulbs: 'chase' },
    layers: { sparkle: true },
  });
  return held(root, sign);
}
