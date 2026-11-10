/** One drum position a frame's blur draws, and its share of the frame. */
export interface BlurSample {
  readonly pos: number;
  readonly weight: number;
}

/** A reel turning more glyphs than this in a frame blurs; at or under it, it draws crisp. */
export const BLUR_FROM = 1;
/** Drum positions drawn per glyph the blur spans. */
const DENSITY = 3;
/** The most drum positions one reel draws in a frame. */
export const MAX_SAMPLES = 8;

/**
 * The drum positions a reel standing at `pos` draws, having turned `travel` glyphs this frame:
 * `pos` alone at or under `BLUR_FROM`, then positions back along the frame's travel, each
 * weighing more the nearer it is to `pos`. From `BLUR_FROM` to twice it the blur fades in, its
 * span growing from nothing to the whole frame's travel and its weight moving off `pos`, so a
 * reel speeding up never jumps from crisp to blurred.
 */
export function blurSamples(pos: number, travel: number): BlurSample[] {
  const fast = Math.abs(travel);
  if (!(fast > BLUR_FROM)) return [{ pos, weight: 1 }];
  const fade = Math.min(1, fast / BLUR_FROM - 1);
  const span = travel * fade;
  const count = Math.min(MAX_SAMPLES, 1 + Math.ceil(Math.abs(span) * DENSITY));
  const total = (count * (count + 1)) / 2;
  return Array.from({ length: count }, (_, i) => ({
    pos: pos - span * (1 - i / (count - 1)),
    weight: (fade * (i + 1)) / total + (i === count - 1 ? 1 - fade : 0),
  }));
}
