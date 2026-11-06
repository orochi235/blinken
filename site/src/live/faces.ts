// ---
import { createMarquee, FACE_NAMES, type FaceName, type Scene } from '@msb235/blinken';
import { checkbox, controls, field, held, stage } from './kit';

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 72, rows: 17 });
  const scene = (): Scene => ({
    effect: 'hold',
    text: 'Type',
    hex: 0xff9a2e,
    face: face.value as FaceName,
    style: { outline: outline.checked, shadow: shadow.checked },
  });
  const row = controls(root);
  const face = field(row, 'face', document.createElement('select'));
  face.append(...FACE_NAMES.map((name) => new Option(name)));
  const outline = field(row, 'outline', checkbox());
  const shadow = field(row, 'shadow', checkbox());
  const sign = createMarquee(canvas, { cols: 72, rows: 17, program: [scene()] });
  for (const input of [face, outline, shadow])
    input.addEventListener('change', () => {
      sign.setProgram([scene()]);
      sign.restart();
    });
  return held(root, sign);
}
