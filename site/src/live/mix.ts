import {
  board,
  createSign,
  KIT,
  type Pose,
  paintBulbs,
  play,
  type Subject,
  signColumns,
} from '@msb235/blinken';
// ---
import { mix } from '@msb235/blits';
import { onHold, stage } from './kit';

export default function run(root: HTMLElement) {
  const b = board(64, 7);
  const m = mix<Subject, Pose>(KIT, { name: 'my sign' });
  play(m, b, [{ effect: 'roll', text: 'MY OWN MIX', hex: 0xff9a2e }]);

  const leds = [...b.dots, ...b.bulbs];
  const cols = signColumns(leds.length);
  const cells = signColumns(b.cells.length);
  const sign = createSign(stage(root, { cols: 64, rows: 7 }), b, leds);

  let last = performance.now();
  let frame = 0;
  const draw = (now: number) => {
    m.sync(now);
    m.pull(b.dots, cols);
    m.pull(b.cells, cells);
    paintBulbs(b, cells, cols);
    sign.render(cols, 0xff9a2e, now - last);
    last = now;
    frame = requestAnimationFrame(draw);
  };
  const stop = onHold(root, (paused) => {
    cancelAnimationFrame(frame);
    if (!paused) {
      m.rebase();
      last = performance.now();
      frame = requestAnimationFrame(draw);
    }
  });
  return () => {
    stop();
    cancelAnimationFrame(frame);
    sign.destroy();
    m.close();
  };
}
