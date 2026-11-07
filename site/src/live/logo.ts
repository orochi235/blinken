import {
  AMBER,
  board,
  createMarquee,
  frameOf,
  gridOf,
  rasterize,
  type Scene,
} from '@msb235/blinken';

export const WORD = 'BLINKEN';

/** The logo's sign: the word in the standard face, with a blank column each side. */
export const LOGO = { cols: rasterize(WORD).cols + 2, rows: 7 } as const;

/** The sign's shape in dot pitches, border and frame included. */
export const FRAME = frameOf(board(LOGO.cols, LOGO.rows));

/**
 * How far in the word's ink starts from the sign's left edge and ends from its right, as shares of
 * its width; a dot is 0.72 pitch wide.
 */
export const INSET = (() => {
  const text = rasterize(WORD);
  const inked = (x: number) => [...Array(LOGO.rows).keys()].some((y) => text.lit(x, y));
  let first = 0;
  while (first < text.cols && !inked(first)) first++;
  let last = text.cols - 1;
  while (last > first && !inked(last)) last--;
  // Column x's center is x + 1 (the blank column) less the frame's corner.
  const center = (x: number) => x + 1 - FRAME.left;
  return {
    left: (center(first) - 0.36) / FRAME.across,
    right: (FRAME.across - center(last) - 0.36) / FRAME.across,
  };
})();

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
    border: { bulbs: still ? 'lit' : 'chase' },
    backend: '2d',
  });
  return () => sign.destroy();
}

/** The word as it stands before the script runs: lit dots on the dark housing, one unit a pitch. */
export function still(): string {
  const text = rasterize(WORD);
  const { across, down, left, top } = FRAME;
  // A dot's center is its column and row, less the frame's corner.
  const dot = (x: number, y: number, fill: string) =>
    `<circle cx="${x - left}" cy="${y - top}" r="0.36" fill="${fill}"/>`;
  const dots: string[] = [];
  for (let y = 0; y < LOGO.rows; y++)
    for (let x = 0; x < LOGO.cols; x++) {
      const on = text.lit(x - 1, y);
      dots.push(dot(x, y, on ? '#ff9a2e' : '#21150f'));
    }
  // The border's bulbs, lit as the logo stands still with reduced motion.
  const grid = gridOf();
  for (const b of board(LOGO.cols, LOGO.rows).bulbs) {
    const [x, y] = grid(b.x, b.y);
    dots.push(`<circle cx="${x - left}" cy="${y - top}" r="0.42" fill="#ffe7bf"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${across} ${down}"><rect width="${across}" height="${down}" rx="0.6" fill="#0d0a08"/>${dots.join('')}</svg>`;
}
