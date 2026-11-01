import { useEffect, useRef, useState } from 'react';
import type { Pass, Stretch } from '@/index.js';
import { watchPass } from './clock.js';
import { IconButton } from './IconButton.js';
import { Panel } from './Panel.js';
import type { Player } from './player.js';
import './Playback.css';

/** One frame of the sign, ms, the size of a step. */
const FRAME_MS = 1000 / 30;
/** The rates the sign can play at. */
const RATES = [0.05, 0.1, 0.25, 0.5, 1, 2, 4] as const;

/** A stretch the sign can loop, named as its radio button reads. */
export interface Focus {
  readonly name: string;
  readonly tip: string;
}

const seconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(2)}s`;

/**
 * Playback for looking closely: play and pause, a frame at a time either way, the sign's rate,
 * and a focus that loops one stretch of the pass, which `spanOf` finds (null for the whole pass).
 */
export function Playback({
  player,
  foci,
  spanOf,
  onFocus,
  rewindLabel,
}: {
  player: Player;
  foci: readonly Focus[];
  spanOf: (pass: Pass, focus: string) => Stretch | null;
  /** Told of each focus picked, before the sign is kept inside it. */
  onFocus?: (focus: string) => void;
  rewindLabel: string;
}) {
  const [paused, setPaused] = useState(false);
  /** The sign waits at a rest for input, which holds it as a pause does. */
  const [waiting, setWaiting] = useState(false);
  const still = paused || waiting;
  const [rate, setRate] = useState(player.rate());
  const [focus, setFocus] = useState(foci[0]?.name ?? '');
  const readout = useRef<HTMLSpanElement>(null);
  const was = useRef<number | null>(null);
  const held = useRef(paused);
  held.current = paused;
  const span = useRef(spanOf);
  span.current = spanOf;

  useEffect(
    () =>
      watchPass(player, (pass) => {
        setWaiting(pass?.waiting ?? false);
        if (!pass) return;
        // An edit replays the sign, which plays it again: a held pass that moves isn't held.
        if (held.current && was.current !== null && Math.abs(pass.at - was.current) > 1)
          setPaused(false);
        const s = span.current(pass, focus);
        if (s && (pass.at < s.start || pass.at >= s.start + s.ms)) {
          player.seek(s.start, held.current);
          was.current = s.start;
          return;
        }
        was.current = pass.at;
        const from = s?.start ?? 0;
        const length = s?.ms ?? pass.length;
        if (readout.current)
          readout.current.textContent = `${seconds(pass.at - from)} / ${seconds(length)}`;
      }),
    [player, focus],
  );

  /** Holds the sign `by` ms from where it stands, kept inside the focus. */
  const step = (by: number) => {
    const pass = player.pass();
    if (!pass) return;
    const s = span.current(pass, focus) ?? { start: 0, ms: pass.length };
    const to = Math.min(s.start + s.ms - 1, Math.max(s.start, pass.at + by));
    setPaused(true);
    held.current = true;
    was.current = to;
    player.seek(to, true);
  };
  const toggle = () => {
    const at = player.pass()?.at ?? 0;
    const next = !still;
    setPaused(next);
    held.current = next;
    was.current = at;
    player.seek(at, next);
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
          label={rewindLabel}
          onClick={() => {
            setPaused(false);
            held.current = false;
            player.restart();
          }}
        />
        <IconButton
          glyph="stepBack"
          label="back one frame (Shift: ten); ← in this panel"
          onClick={() => step(-FRAME_MS)}
        />
        <IconButton
          glyph={still ? 'play' : 'pause'}
          label={
            paused
              ? 'play on from here (Space)'
              : waiting
                ? 'waiting for a key; play on from here (Space)'
                : 'hold the sign where it is (Space)'
          }
          pressed={still}
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
            player.setRate(next);
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
        {foci.map((f) => (
          <label key={f.name} className="compose-check" title={f.tip}>
            <input
              type="radio"
              name="playback-focus"
              checked={focus === f.name}
              onChange={() => {
                setFocus(f.name);
                onFocus?.(f.name);
              }}
            />
            {f.name}
          </label>
        ))}
      </div>
    </Panel>
  );
}
