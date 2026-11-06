// ---
import { createMarquee } from '@msb235/blinken';
import { held, stage } from './kit';

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 64, rows: 7 });
  const sign = createMarquee(canvas, {
    cols: 64,
    rows: 7,
    program: [
      {
        text: 'SPIN CYCLE',
        hex: 0xff4030,
        effect: {
          name: 'spin',
          enter: { move: 'unfold' },
          active: [
            { move: 'tumble' },
            { mod: 'hue-cycle', spread: { by: 'column' }, params: { phase: 0.015 } },
          ],
          exit: { move: 'rain-out' },
          order: { by: 'letter', lag: 60 },
          hold: 3000,
        },
      },
    ],
  });
  return held(root, sign);
}
