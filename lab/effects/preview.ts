import { createContext, useContext } from 'react';
import { AMBER, type Marquee, type Scene } from '@/index.js';
import { type Designer, designer } from '../compose/designer/open.js';
import { shelved } from '../compose/library.js';
import { carried, carrier, type Player } from '../compose/player.js';
import { STILL } from '../compose/Thumbnail.js';

export type Preview = Player & { attach(next: Marquee | null): void; step(): void; scene(): Scene };

/** A sign playing what `designer` has open, which the playback controls and the scrubber drive. */
export function createPreview(designer: Designer): Preview {
  /**
   * The one scene the preview loops: the open effect, the library's spec itself so no effects map
   * has to name it, on the preview text; with nothing open, the text standing still.
   */
  const scene = (): Scene => {
    const name = designer.open();
    const effect = name === undefined ? STILL : (shelved(designer.library.get(), name) ?? name);
    return { effect, text: designer.text() || ' ', hex: AMBER };
  };
  const state = carried();
  let shown = JSON.stringify(scene());
  // Opening an effect, editing it, or changing the text plays the new scene from its start.
  designer.subscribe(() => {
    const next = JSON.stringify(scene());
    if (next === shown) return;
    shown = next;
    state.held = false;
    state.sign?.restart(0);
  });
  return {
    ...carrier(state),
    scene,
    /** Moves an effect paced by input on a letter. */
    step: () => state.sign?.step(),
    restart() {
      state.held = false;
      state.sign?.restart(0);
    },
  };
}

/** The effects page's sign. */
export const preview = createPreview(designer);

export const PreviewContext = createContext<Preview>(preview);

/** The preview in context: the page's unless a provider gives another. */
export const usePreview = (): Preview => useContext(PreviewContext);
