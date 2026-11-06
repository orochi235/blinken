import { AMBER, board, createMarquee, frameOf, rasterize, type Scene } from '@msb235/blinken';

export const WORD = 'BLINKEN';

/** The logo's sign: the word in the standard face, with a blank column each side. */
export const LOGO = { cols: rasterize(WORD).cols + 2, rows: 7 } as const;

/** The sign's shape in dot pitches, border and frame included. */
export const FRAME = frameOf(board(LOGO.cols, LOGO.rows));

const EFFECTS = ['hold', 'flip', 'fall', 'swarm', 'roll', 'matris', 'tile'] as const;

function program(still: boolean): Scene[] {
  const scene = (effect: string): Scene => ({ effect, text: WORD, hex: AMBER });
  return still ? [scene('hold')] : EFFECTS.map(scene);
}

/** Plays the wordmark on `canvas`, its border's bulbs chasing; with reduced motion it stands still. */
export function playLogo(canvas: HTMLCanvasElement): () => void {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sign = createMarquee(canvas, {
    ...LOGO,
    name: 'logo',
    program: program(still),
    layers: { chase: !still },
    backend: '2d',
  });
  return () => sign.destroy();
}

/** The word as it stands before the script runs: lit dots on the dark housing, one unit a pitch. */
export function still(): string {
  const text = rasterize(WORD);
  const { across, down, left, top } = FRAME;
  const dot = (x: number, y: number, fill: string) =>
    `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.36" fill="${fill}"/>`;
  const dots: string[] = [];
  for (let y = 0; y < LOGO.rows; y++)
    for (let x = 0; x < LOGO.cols; x++) {
      const on = text.lit(x - 1, y);
      dots.push(dot(left + x, top + y, on ? '#ff9a2e' : '#21150f'));
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${across} ${down}"><rect width="${across}" height="${down}" rx="0.6" fill="#0d0a08"/>${dots.join('')}</svg>`;
}
