import { AMBER, type Marquee, type Scene } from '@/index.js';
import { designer } from '../compose/designer/open.js';
import { library, shelved } from '../compose/library.js';
import { carried, carrier, type Player } from '../compose/player.js';
import { STILL } from '../compose/Thumbnail.js';

/**
 * The one scene the preview loops: the open effect, the library's spec itself so no effects map
 * has to name it, on the preview text; with nothing open, the text standing still.
 */
export function previewScene(): Scene {
  const name = designer.open();
  const effect = name === undefined ? STILL : (shelved(library.get(), name) ?? name);
  return { effect, text: designer.text() || ' ', hex: AMBER };
}

const state = carried();
let shown = JSON.stringify(previewScene());

/** The effects page's sign, which the playback controls and the scrubber drive. */
export const preview: Player & { attach(next: Marquee | null): void; step(): void } = {
  ...carrier(state),
  /** Moves an effect paced by input on a letter. */
  step: () => state.sign?.step(),
  restart() {
    state.held = false;
    state.sign?.restart(0);
  },
};

// Opening an effect, editing it, or changing the text plays the new scene from its start.
designer.subscribe(() => {
  const next = JSON.stringify(previewScene());
  if (next === shown) return;
  shown = next;
  state.held = false;
  state.sign?.restart(0);
});
