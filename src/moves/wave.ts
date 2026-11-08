import { patch } from '@msb235/blits';
import type { Led, Pose } from '../board.js';
import type { Placed } from '../orders.js';
import { LOOSE, lineAt, linesOf, move, movedAt, on } from './move.js';
import {
  boundLines,
  LINE_AT,
  type Lookup,
  linesParams,
  MOVED,
  movedOf,
  moveShader,
  ROUND,
  ROWS,
} from './shader.js';

/** How long the wave takes to swell from still, or settle back to it, at most. */
const SWELL = 600;
const smooth = (u: number) => u * u * (3 - 2 * u);

/**
 * How many waves a pass holds, what share of it the wave swells over, the text's lines, and the
 * column the wave is read at for column `x` of line `n` of the text.
 */
function shape(at: Placed, p: { ms: number; period: number; by: string }) {
  const { text } = at;
  // A whole number of waves per pass, so a loose one loops without a seam.
  const waves = Math.max(1, Math.round(p.ms / p.period));
  const swell = Math.min(SWELL, p.ms / 4) / p.ms;
  const lines = linesOf(text);
  const anchor =
    p.by === 'letter'
      ? (x: number, n: number) => {
          const s = text.letters
            .filter((s) => s.y === n * text.pitch && x >= s.x && x < s.x + s.width)
            .at(-1);
          return s ? s.x + (s.width - 1) / 2 : x;
        }
      : (x: number) => x;
  return { waves, swell, lines, anchor };
}

/**
 * The wave, reading the column it is read at for each column of each line of the text from
 * `anchor`. Each line moves by its own letters, so a dot shows whichever line's row reaches it.
 */
const WAVE = moveShader({
  params: [
    'left',
    'cols',
    'height',
    'length',
    'waves',
    'swell',
    'from',
    'to',
    'lines',
    'pitch',
    'middle',
  ],
  wgsl: `let env = select(1.0, blinken_smooth(min(1.0, phase / params.swell)), params.from > 0.5)
  * select(1.0, blinken_smooth(min(1.0, (1.0 - phase) / params.swell)), params.to > 0.5);
let x = subject.x - params.left;
for (var n = 0.0; n < params.lines; n = n + 1.0) {
  let a = select(x, table_anchor(x, n), x >= 0.0 && x < params.cols);
  let turns = a / params.length - params.waves * phase;
  let dy = ${ROUND('params.height * env * sin(6.283185307179586 * (turns - floor(turns)))')};
  let shown = ${ROWS('subject.y - dy')} - 1.0;
  lit = max(lit, select(0.0, ${MOVED('params.left', 'dy')}, ${LINE_AT('shown')} == n));
}`,
  at(phase, d, p, t) {
    const envelope =
      (p.from ? smooth(Math.min(1, phase / (p.swell as number))) : 1) *
      (p.to ? smooth(Math.min(1, (1 - phase) / (p.swell as number))) : 1);
    const x = d.x - (p.left as number);
    const lines = boundLines(p);
    let lit = 0;
    for (let n = 0; n < lines.count; n++) {
      const a = x >= 0 && x < (p.cols as number) ? (t.anchor as Lookup)(x, n) : x;
      const angle = 2 * Math.PI * (a / (p.length as number) - (p.waves as number) * phase);
      const dy = Math.round((p.height as number) * envelope * Math.sin(angle));
      const shown = (t.rows as Lookup)(0, d.y - dy) - 1;
      if (lineAt(lines, shown) === n) lit = Math.max(lit, movedOf(t, d, p.left as number, dy));
    }
    return lit;
  },
});

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
    const { waves, swell, lines, anchor } = shape(at, p);
    return patch<Led, Pose>(
      p.ms,
      (phase, led) => {
        const envelope =
          (joins.from ? smooth(Math.min(1, phase / swell)) : 1) *
          (joins.to ? smooth(Math.min(1, (1 - phase) / swell)) : 1);
        const x = led.x - at.left;
        let lit = 0;
        for (let n = 0; n < lines.count; n++) {
          const angle = 2 * Math.PI * (anchor(x, n) / p.length - waves * phase);
          const dy = Math.round(p.height * envelope * Math.sin(angle));
          const shown = at.rowOf({ kind: 'dot', x: led.x, y: led.y - dy });
          if (lineAt(lines, shown) === n) lit = Math.max(lit, movedAt(at, led, dy));
        }
        return on(lit);
      },
      { writes: ['lit'] },
    );
  },
  shader(at, p, joins = LOOSE) {
    const { waves, swell, lines, anchor } = shape(at, p);
    const cols = at.text.cols;
    const width = Math.max(1, cols);
    const anchors = Array.from({ length: width * lines.count }, (_, i) =>
      anchor(i % width, Math.floor(i / width)),
    );
    return WAVE(
      at,
      p.ms,
      {
        left: at.left,
        cols,
        height: p.height,
        length: p.length,
        waves,
        swell,
        from: joins.from ? 1 : 0,
        to: joins.to ? 1 : 0,
        ...linesParams(lines),
      },
      { anchor: { width, height: lines.count, data: anchors } },
    );
  },
});
