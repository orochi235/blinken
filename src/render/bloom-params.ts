/** How a light blooms, shared by every renderer. */
export const BLOOM = {
  /** Blur radius in pitches, multiplied by `lamps.glow`. */
  spread: 0.9,
} as const;

/** The housing behind the lights. */
export const HOUSING = 0x0d0a08;
/** The socket a dot sits in. */
export const DOT_COLOR = 0x21150f;
/** The socket a border bulb sits in. */
export const BULB_COLOR = 0x2b2118;
