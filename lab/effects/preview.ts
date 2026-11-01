import { AMBER, type Marquee, type Scene } from '@/index.js';
import { designer } from '../compose/designer/open.js';
import { library, shelved } from '../compose/library.js';
import type { Player } from '../compose/player.js';
import { STILL } from '../compose/Thumbnail.js';

/** The preview's color: a sodium amber, as the thumbnails are. */

/**
 * The one scene the preview loops: the open effect, the library's spec itself so no effects map
 * has to name it, on the preview text; with nothing open, the text standing still.
 */
export function previewScene(): Scene {
  const name = designer.open();
  const effect = name === undefined ? STILL : (shelved(library.get(), name) ?? name);
  return { effect, text: designer.text() || ' ', hex: AMBER };
}

let sign: Marquee | null = null;
let rate = 1;
let held = false;
/** Where the last sign's pass stood when it was taken down, for the next one to play on from. */
let resume: number | undefined;
let shown = JSON.stringify(previewScene());

/** The effects page's sign, which the playback controls and the scrubber drive. */
export const preview: Player & { attach(next: Marquee | null): void; step(): void } = {
  pass: () => sign?.pass() ?? null,
  /** Moves an effect paced by input on a letter. */
  step: () => sign?.step(),
  seek(ms, hold = false) {
    held = hold;
    sign?.seek(ms, { hold });
  },
  restart() {
    held = false;
    sign?.restart(0);
  },
  rate: () => rate,
  setRate(next) {
    rate = next;
    sign?.ramp(next, 150);
  },
  /** Takes the sign the page drew, or null as it goes; a new one plays on from where the last stood. */
  attach(next) {
    if (!next) resume = sign?.pass()?.at;
    sign = next;
    if (next && rate !== 1) next.ramp(rate, 0);
    if (next && resume !== undefined) next.seek(resume, { hold: held });
  },
};

// Opening an effect, editing it, or changing the text plays the new scene from its start.
designer.subscribe(() => {
  const next = JSON.stringify(previewScene());
  if (next === shown) return;
  shown = next;
  held = false;
  sign?.restart(0);
});
