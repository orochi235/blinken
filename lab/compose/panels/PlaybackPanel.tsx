import type { Pass, Slot, Stretch } from '@/index.js';
import { CHOICES, type Choice } from '../../backend.js';
import { useGpu } from '../../gpu.js';
import { type Focus, Playback } from '../Playback.js';
import { compose, pickedOf, useChoice, useCompose, useDrawing } from '../store.js';

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

/** Each backend as the select names it, and what picking it does. */
const NAMES: Readonly<Record<Choice, string>> = {
  auto: 'Auto',
  webgpu: 'WebGPU',
  webgl: 'WebGL',
  '2d': '2D',
};
const TIPS: Readonly<Record<Choice, string>> = {
  auto: 'Let the sign pick: WebGPU where this browser has it, else WebGL, else 2D.',
  webgpu: 'Draw the lights on the GPU through WebGPU.',
  webgl: "Draw the lights on the GPU through WebGL 2, or in 2D where WebGL won't start.",
  '2d': 'Draw the lights on the CPU with the canvas 2D API, the look the GPU ones match.',
};
const NO_WEBGPU = 'This browser has no WebGPU.';

/** Which backend the sign draws with, and the one it actually got. */
function BackendSelect() {
  const choice = useChoice();
  const drawing = useDrawing();
  const webgpu = Boolean(useGpu());
  return (
    <div className="compose-playback-backend">
      <select
        aria-label="backend"
        title="What draws the sign. Switching builds it again on a fresh canvas."
        value={choice}
        onChange={(e) => compose.setBackend(e.target.value as Choice)}
      >
        {CHOICES.map((c) => {
          const off = c === 'webgpu' && !webgpu;
          return (
            <option key={c} value={c} disabled={off} title={off ? NO_WEBGPU : TIPS[c]}>
              {NAMES[c]}
            </option>
          );
        })}
      </select>
      <span className="compose-playback-drawing" title="The backend the sign is drawing with now.">
        drawing: {drawing ? NAMES[drawing] : ''}
      </span>
    </div>
  );
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
    >
      <BackendSelect />
    </Playback>
  );
}
