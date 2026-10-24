import { useEffect, useRef, useState } from 'react';
import type { Pass, Slot, Stretch } from '@/index.js';
import { watchPass } from '../clock.js';
import { IconButton } from '../IconButton.js';
import { Panel } from '../Panel.js';
import { compose, pickedOf, useCompose } from '../store.js';
import './PlaybackPanel.css';

/** One frame of the sign, ms, the size of a step. */
const FRAME_MS = 1000 / 30;
/** The rates the sign can play at. */
const RATES = [0.05, 0.1, 0.25, 0.5, 1, 2, 4] as const;
/** What the sign loops: the whole pass, the picked scene, or one part of it. */
const FOCI = ['all', 'scene', 'enter', 'active', 'exit'] as const;
type Focus = (typeof FOCI)[number];
const FOCUS_TIPS: Record<Focus, string> = {
  all: 'Play the whole program round.',
  scene: 'Play the scene you are editing on its own, round and round.',
  enter: 'Loop how the scene you are editing comes on.',
  active: 'Loop the scene you are editing while it stands.',
  exit: 'Loop how the scene you are editing goes.',
};

/** The stretch of `pass` that `focus` loops, or null for the whole of it, or a scene or part not in it. */
function spanOf(pass: Pass, focus: Focus, picked: number): Stretch | null {
  if (focus === 'all') return null;
  const scene = pass.scenes.find((s) => compose.sceneOf(s) === picked);
  if (!scene) return null;
  const span = focus === 'scene' ? scene : scene.parts[focus as Slot];
  // An effect with no such part has nothing to loop.
  return span.ms > 0 ? span : null;
}

const seconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(2)}s`;

/**
 * Playback for looking closely: play and pause, a frame at a time either way, the sign's rate,
 * and a focus that loops the picked scene or one part of it.
 */
export function PlaybackPanel() {
  const state = useCompose();
  const picked = pickedOf(state);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(compose.rate());
  const [focus, setFocus] = useState<Focus>('all');
  const readout = useRef<HTMLSpanElement>(null);
  const was = useRef<number | null>(null);
  const held = useRef(paused);
  held.current = paused;

  useEffect(
    () =>
      watchPass((pass) => {
        if (!pass) return;
        // An edit replays the sign, which plays it again: a held pass that moves isn't held.
        if (held.current && was.current !== null && Math.abs(pass.at - was.current) > 1)
          setPaused(false);
        const span = spanOf(pass, focus, picked);
        if (span && (pass.at < span.start || pass.at >= span.start + span.ms)) {
          compose.seek(span.start, held.current);
          was.current = span.start;
          return;
        }
        was.current = pass.at;
        const from = span?.start ?? 0;
        const length = span?.ms ?? pass.length;
        if (readout.current)
          readout.current.textContent = `${seconds(pass.at - from)} / ${seconds(length)}`;
      }),
    [focus, picked],
  );

  /** Holds the sign `by` ms from where it stands, kept inside the focus. */
  const step = (by: number) => {
    const pass = compose.pass();
    if (!pass) return;
    const span = spanOf(pass, focus, picked) ?? { start: 0, ms: pass.length };
    const to = Math.min(span.start + span.ms - 1, Math.max(span.start, pass.at + by));
    setPaused(true);
    held.current = true;
    was.current = to;
    compose.seek(to, true);
  };
  const toggle = () => {
    const at = compose.pass()?.at ?? 0;
    const next = !paused;
    setPaused(next);
    held.current = next;
    was.current = at;
    compose.seek(at, next);
  };

  return (
    <Panel
      title="playback"
      className="compose-playback"
      actions={<span ref={readout} className="compose-playback-time" aria-live="off" />}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the keys only repeat the buttons below */}
      <div
        className="compose-playback-row"
        onKeyDown={(e) => {
          const frames = e.shiftKey ? 10 : 1;
          if (e.key === ' ') toggle();
          else if (e.key === 'ArrowLeft') step(-FRAME_MS * frames);
          else if (e.key === 'ArrowRight') step(FRAME_MS * frames);
          else return;
          e.preventDefault();
        }}
      >
        <IconButton
          glyph="rewind"
          label="play again from the start of the scene you are editing"
          onClick={() => {
            setPaused(false);
            held.current = false;
            compose.restart();
          }}
        />
        <IconButton
          glyph="stepBack"
          label="back one frame (Shift: ten); ← in this panel"
          onClick={() => step(-FRAME_MS)}
        />
        <IconButton
          glyph={paused ? 'play' : 'pause'}
          label={paused ? 'play on from here (Space)' : 'hold the sign where it is (Space)'}
          pressed={paused}
          onClick={toggle}
        />
        <IconButton
          glyph="stepForward"
          label="on one frame (Shift: ten); → in this panel"
          onClick={() => step(FRAME_MS)}
        />
        <select
          className="compose-playback-rate"
          aria-label="speed"
          title="How fast the sign plays. Slow it down to watch a move frame by frame."
          value={rate}
          onChange={(e) => {
            const next = Number(e.target.value);
            setRate(next);
            compose.setRate(next);
          }}
        >
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </div>
      <div className="compose-playback-focus" role="radiogroup" aria-label="focus">
        {FOCI.map((f) => (
          <label key={f} className="compose-check" title={FOCUS_TIPS[f]}>
            <input
              type="radio"
              name="playback-focus"
              checked={focus === f}
              onChange={() => {
                setFocus(f);
                // Anything narrower than the program plays the picked scene alone.
                compose.setSolo(f !== 'all');
              }}
            />
            {f}
          </label>
        ))}
      </div>
    </Panel>
  );
}
