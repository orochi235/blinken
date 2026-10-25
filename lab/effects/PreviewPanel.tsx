import { Input } from '@weasel-js/ui';
import type { Pass, Slot, Stretch } from '@/index.js';
import { designer, useDesk } from '../compose/designer/open.js';
import { useHardware } from '../compose/hardware.js';
import { Panel } from '../compose/Panel.js';
import { type Focus, Playback } from '../compose/Playback.js';
import { type SceneLook, Scrubber } from '../compose/Scrubber.js';
import { Sign } from '../compose/Sign.js';
import { preview, previewScene } from './preview.js';
import './PreviewPanel.css';

const NO_EFFECTS = () => ({});
const program = () => [previewScene()];
const look: SceneLook = () => previewScene();

/**
 * The open effect looping on the sign compose plays on, its hardware shared with compose, on text
 * typed here, and changing as the designer does.
 */
export function PreviewPanel() {
  useDesk();
  const [hardware] = useHardware();
  return (
    <Panel
      title="preview"
      className="effects-preview"
      actions={
        <span className="effects-preview-text" title="The message the preview plays the effect on.">
          <Input
            aria-label="preview text"
            value={designer.text()}
            onChange={(v) => designer.setText(v)}
          />
        </span>
      }
    >
      <Sign hardware={hardware} program={program} effects={NO_EFFECTS} onSign={preview.attach} />
      <Scrubber player={preview} look={look} />
      {designer.open() === undefined && (
        <p className="compose-hint">Open an effect from the library to play it here.</p>
      )}
    </Panel>
  );
}

/** What the preview loops: the whole effect, or one of its parts. */
const FOCI: readonly Focus[] = [
  { name: 'whole', tip: 'Play the whole effect round.' },
  { name: 'enter', tip: 'Loop how the effect brings the message on.' },
  { name: 'active', tip: 'Loop the effect while the message stands.' },
  { name: 'exit', tip: 'Loop how the effect takes the message off.' },
];

/** The stretch of the preview's one scene that `focus` loops, or null for all of it, or a part it lacks. */
function spanOf(pass: Pass, focus: string): Stretch | null {
  const scene = pass.scenes[0];
  if (focus === 'whole' || !scene) return null;
  const span = scene.parts[focus as Slot];
  return span.ms > 0 ? span : null;
}

/** Playback for the preview: play and pause, step, speed, and a part of the effect to loop. */
export function PreviewPlayback() {
  return (
    <Playback
      player={preview}
      foci={FOCI}
      spanOf={spanOf}
      rewindLabel="play the effect again from its start"
    />
  );
}
