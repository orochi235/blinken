import type { Pass, Slot, Stretch } from '@/index.js';
import { type Focus, Playback } from '../Playback.js';
import { compose, pickedOf, useCompose } from '../store.js';

/** What the sign loops: the whole pass, the picked scene, or one part of it. */
const FOCI: readonly Focus[] = [
  { name: 'all', tip: 'Play the whole program round.' },
  { name: 'scene', tip: 'Play the scene you are editing on its own, round and round.' },
  { name: 'enter', tip: 'Loop how the scene you are editing comes on.' },
  { name: 'active', tip: 'Loop the scene you are editing while it stands.' },
  { name: 'exit', tip: 'Loop how the scene you are editing goes.' },
];

/** The stretch of `pass` that `focus` loops, or null for the whole of it, or a scene or part not in it. */
function spanOf(pass: Pass, focus: string, picked: number): Stretch | null {
  if (focus === 'all') return null;
  const scene = pass.scenes.find((s) => compose.sceneOf(s) === picked);
  if (!scene) return null;
  const span = focus === 'scene' ? scene : scene.parts[focus as Slot];
  // An effect with no such part has nothing to loop.
  return span.ms > 0 ? span : null;
}

/** Compose's playback: the program, or the scene being edited or one part of it. */
export function PlaybackPanel() {
  const picked = pickedOf(useCompose());
  return (
    <Playback
      player={compose}
      foci={FOCI}
      spanOf={(pass, focus) => spanOf(pass, focus, picked)}
      // Anything narrower than the program plays the picked scene alone.
      onFocus={(f) => compose.setSolo(f !== 'all')}
      rewindLabel="play again from the start of the scene you are editing"
    />
  );
}
