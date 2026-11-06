// ---
import { createMarquee, HOUSINGS, type Marquee } from '@msb235/blinken';
import { held, stage } from './kit';

export default function run(root: HTMLElement) {
  root.classList.add('light');
  const signs: Marquee[] = HOUSINGS.map((housing) =>
    createMarquee(stage(root, { cols: 40, rows: 7 }), {
      cols: 40,
      rows: 7,
      housing,
      program: [{ effect: 'hold', text: housing.toUpperCase(), hex: 0xff4030 }],
    }),
  );
  const [first, ...rest] = signs;
  return held(root, first as Marquee, () => {
    for (const s of rest) s.destroy();
  });
}
