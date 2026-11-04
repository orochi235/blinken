/** The blur's taps either side of center. */
export const TAPS = 16;

/** One axis's weights for a Gaussian of `sigma` texels, and the texels between taps. */
export function gaussian(sigma: number): { weights: Float32Array; spacing: number } {
  const spacing = Math.max(1, (3 * sigma) / TAPS);
  const weights = new Float32Array(TAPS + 1);
  let sum = 0;
  for (let i = 0; i <= TAPS; i++) {
    const d = i * spacing;
    weights[i] = Math.exp(-(d * d) / (2 * sigma * sigma));
    sum += (i === 0 ? 1 : 2) * (weights[i] as number);
  }
  for (let i = 0; i <= TAPS; i++) weights[i] = (weights[i] as number) / sum;
  return { weights, spacing };
}

/** 0xRRGGBB as r, g and b, 0..1. */
export const rgb = (hex: number): [number, number, number] => [
  ((hex >> 16) & 0xff) / 255,
  ((hex >> 8) & 0xff) / 255,
  (hex & 0xff) / 255,
];
