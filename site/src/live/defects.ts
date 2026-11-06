// ---
import { createMarquee, scatter } from '@msb235/blinken';
import { controls, field, held, slider, stage } from './kit';

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 48, rows: 7 });
  const sign = createMarquee(canvas, {
    cols: 48,
    rows: 7,
    program: [{ effect: 'scroll', text: 'STILL OPEN', hex: 0xff9a2e }],
  });
  const row = controls(root);
  const broken = field(row, 'broken', slider(0, 0.3, 0.01, 0.08));
  const fall = field(row, 'fade out, ms', slider(0, 600, 10, 110));
  const ghost = field(row, 'ghost', slider(0, 0.3, 0.01, 0.06));
  const apply = () => {
    const share = Number(broken.value);
    sign.setDefects(
      scatter(sign.board, { dead: share / 2, dim: share / 3, flicker: share / 6 }, 7),
    );
    sign.setFade({ rise: 12, fall: Number(fall.value) });
    sign.setGhost({ col: Number(ghost.value) });
  };
  for (const input of [broken, fall, ghost]) input.addEventListener('input', apply);
  apply();
  return held(root, sign);
}
