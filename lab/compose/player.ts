import type { Pass } from '@/index.js';

/** A sign the playback controls and the scrubber drive: compose's store, or the effects page's preview. */
export interface Player {
  /** Where the sign's pass stands, or null with no sign or nothing playing. */
  pass(): Pass | null;
  /** Moves the pass to `ms`, held there with `hold`. */
  seek(ms: number, hold?: boolean): void;
  /** Plays again from the start of whatever the sign is looping. */
  restart(): void;
  rate(): number;
  setRate(rate: number): void;
}
