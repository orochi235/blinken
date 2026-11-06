// ---
import { createThumbnail, type Thumbnail } from '@msb235/blinken';
import { onHold } from './kit';

export default function run(root: HTMLElement) {
  const strip = document.createElement('div');
  strip.className = 'thumb-strip';
  root.append(strip);
  const thumbs: Thumbnail[] = ['flip', 'roll', 'tile', 'swarm'].map((effect) => {
    const box = document.createElement('div');
    const canvas = document.createElement('canvas');
    box.append(canvas);
    strip.append(box);
    return createThumbnail(canvas, { effect, text: 'OPEN', hex: 0xff9a2e });
  });
  const stop = onHold(root, (paused) => {
    for (const t of thumbs) t.play(!paused);
  });
  return () => {
    stop();
    for (const t of thumbs) t.destroy();
  };
}
