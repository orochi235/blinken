// ---
import { createMarquee, type EffectSpec } from '@msb235/blinken';
import { held, stage } from './kit';

/** Drops in letter by letter, flashes while it holds, and falls away. */
const blink: EffectSpec = {
  name: 'blink',
  about: 'Drops in letter by letter, flashes, and falls away.',
  order: { by: 'letter', lag: 90 },
  enter: { move: 'drop-in' },
  active: [{ move: 'stand' }, { mod: 'flash', params: { flashes: 4 } }],
  exit: { move: 'drop-out' },
  hold: 2400,
};

export default function run(root: HTMLElement) {
  const canvas = stage(root, { cols: 48, rows: 7 });
  const sign = createMarquee(canvas, {
    cols: 48,
    rows: 7,
    effects: { blink },
    program: [
      { effect: 'blink', text: 'TONIGHT ONLY', hex: 0xff9a2e },
      { effect: 'fall', text: 'TONIGHT ONLY', hex: 0x6dff5a, params: { blend: 200 } },
    ],
  });
  return held(root, sign);
}
