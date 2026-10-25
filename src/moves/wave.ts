import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import { LOOSE, move, movedAt, on } from './move.js';

/** How long the wave takes to swell from still, or settle back to it, at most. */
const SWELL = 600;
const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * The message bobbing in a sine wave traveling along it. Beside an enter or exit move it swells
 * from still and settles back, so it starts and ends where they leave or want the message.
 */
export const wave = move({
  name: 'wave',
  about: 'Letters or columns bob up and down in a wave traveling along the message.',
  slot: 'active',
  params: {
    ms: {
      label: 'length',
      min: 500,
      max: 12000,
      step: 100,
      value: 3600,
      unit: 'ms',
      about: 'How long the message waves.',
    },
    height: {
      label: 'height',
      min: 1,
      max: 6,
      step: 1,
      value: 1,
      unit: 'rows',
      about: 'How many rows the wave lifts the message above and drops it below where it stands.',
    },
    length: {
      label: 'wavelength',
      min: 4,
      max: 120,
      step: 1,
      value: 24,
      unit: 'cols',
      about: 'How many columns from one crest to the next. Lower makes a choppier wave.',
    },
    period: {
      label: 'wave time',
      min: 200,
      max: 4000,
      step: 50,
      value: 1200,
      unit: 'ms',
      about: 'How long one crest takes to pass a point. Higher travels more slowly.',
    },
    by: {
      label: 'moves',
      choices: ['letter', 'column'],
      value: 'letter',
      about: 'Whether each letter bobs whole, or every column on its own, bending the letters.',
    },
  },
  patch(at, p, joins = LOOSE) {
    const { text } = at;
    // A whole number of waves per pass, so a loose one loops without a seam.
    const waves = Math.max(1, Math.round(p.ms / p.period));
    const swell = Math.min(SWELL, p.ms / 4) / p.ms;
    const middles = text.letters.map((s) => s.x + (s.width - 1) / 2);
    /** The column the wave is read at for column `x` of the text. */
    const anchor =
      p.by === 'letter'
        ? (x: number) => {
            const k = text.letterAt(x);
            return k >= 0 ? (middles[k] as number) : x;
          }
        : (x: number) => x;
    return patch<Led, Pose>(
      p.ms,
      (phase, led) => {
        const envelope =
          (joins.from ? smooth(Math.min(1, phase / swell)) : 1) *
          (joins.to ? smooth(Math.min(1, (1 - phase) / swell)) : 1);
        const x = led.x - at.left;
        const angle = 2 * Math.PI * (anchor(x) / p.length - waves * phase);
        const dy = Math.round(p.height * envelope * Math.sin(angle));
        return on(movedAt(at, led, dy));
      },
      { writes: ['lit'] },
    );
  },
});
