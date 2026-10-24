import { Button } from '@weasel-js/labkit';
import { Input, RangeSlider } from '@weasel-js/ui';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import type { Thumbnail as Handle } from '@/index.js';
import {
  FACE_NAMES,
  FACES,
  type FaceName,
  marginOf,
  placeText,
  rasterize,
  rowsToShow,
  type TextStyle,
} from '@/index.js';
import { AMBER } from '../../demo.js';
import { useLive } from '../live.js';
import { Panel } from '../Panel.js';
import { exitOf, REST, reelOf } from '../reel.js';
import { withLook } from '../state.js';
import { compose, pickedOf, useBoard, useCompose } from '../store.js';
import { NO_EFFECTS, Thumbnail } from '../Thumbnail.js';
import '../Row.css';
import './FontPanel.css';

/** A face's body height: the rows its lines are spaced by, ghost rows aside. */
const bodyOf = (name: FaceName) => {
  const f = FACES[name];
  return f.rows - (f.above ?? 0) - (f.below ?? 0);
};
const BODIES = FACE_NAMES.map(bodyOf);
const SHORTEST = Math.min(...BODIES);
const TALLEST = Math.max(...BODIES);

/** The picked scene's face, each one previewed on its text, and its style. */
export function FontPanel({ setRows }: { setRows: (rows: number) => void }) {
  const state = useCompose();
  const [search, setSearch] = useState('');
  const [heights, setHeights] = useState<number[]>([SHORTEST, TALLEST]);
  const list = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const watch = new ResizeObserver(() => setWidth(el.clientWidth));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const at = pickedOf(state);
  const scene = state.program[at];
  if (!scene) return null;
  const face = typeof scene.face === 'string' ? scene.face : 'standard';
  const set = (what: 'face' | 'reverse' | 'proportional', v: unknown) =>
    compose.edit(
      (s) => {
        const was = s.program[at];
        if (was) s.program[at] = withLook(was, what, v);
      },
      { replay: at },
    );
  return (
    <Panel
      title="font"
      className="compose-font"
      actions={
        <span className="compose-font-find" title="Narrow the faces by name.">
          <Input
            aria-label="find a face"
            placeholder="find a face"
            value={search}
            onChange={setSearch}
          />
        </span>
      }
    >
      <Fit setRows={setRows} />
      <div className="compose-font-styles">
        <label
          className="compose-check"
          title="Inverse video: the message’s box lights up and the letters show as dark dots in it."
        >
          <input
            type="checkbox"
            checked={scene.style?.reverse === true}
            onChange={(e) => set('reverse', e.target.checked)}
          />
          reverse
        </label>
        <label
          className="compose-check"
          title="Spaces each letter by its own width, so narrow letters like I sit closer to their neighbors. Off, every letter takes the same width."
        >
          <input
            type="checkbox"
            checked={scene.style?.proportional === true}
            onChange={(e) => set('proportional', e.target.checked)}
          />
          proportional
        </label>
        <span
          className="compose-font-height"
          title="Narrow the faces by how many rows tall their letters are."
        >
          <RangeSlider
            label="height"
            minValue={SHORTEST}
            maxValue={TALLEST}
            step={1}
            value={heights}
            onChange={(v) => setHeights(Array.isArray(v) ? v : [v, v])}
            formatOutput={(v) => (Array.isArray(v) ? `${v[0]}–${v[1]} rows` : `${v} rows`)}
          />
        </span>
      </div>
      <div
        ref={list}
        className="compose-rows compose-font-faces"
        role="radiogroup"
        aria-label="face"
      >
        {FACE_NAMES.filter((name) => {
          const body = bodyOf(name);
          return (
            name.includes(search.trim().toLowerCase()) &&
            body >= (heights[0] ?? SHORTEST) &&
            body <= (heights[1] ?? TALLEST)
          );
        }).map((name: FaceName) => (
          <FaceRow
            key={name}
            name={name}
            width={width}
            style={scene.style}
            picked={name === face}
            onPick={() => set('face', name)}
          />
        ))}
      </div>
    </Panel>
  );
}

/** A face row's dot pitch, px: every row's dots are this size, so a row is as tall as its face. */
const PITCH = 3;
/** How long a row takes to run back to rest across the whole sign, ms, ramps included. */
const EXIT_MS = 400;
/** How long the way back takes to speed up, and again to slow down, ms. */
const RAMP_MS = 80;
/** The width the glyph metrics take at a row's right end, px. */
const METRICS_PX = 44;

/**
 * A face's row: its name set in it at rest; hovered, the name scrolls out as the specimen scrolls
 * in, round and round; let go, it runs back to the name by the shorter way. Its glyph width and
 * height sit at the right end.
 */
function FaceRow({
  name,
  picked,
  onPick,
  width,
  style,
}: {
  name: FaceName;
  picked: boolean;
  onPick: () => void;
  width: number;
  /** The picked scene's style, which every row is drawn in. */
  style?: TextStyle;
}) {
  const { live, on } = useLive();
  const margin = marginOf(false);
  const least = rasterize(name, { face: name, style }).cols + 2 * REST;
  const cols = Math.max(least, Math.floor((width - METRICS_PX) / PITCH) - 2 * margin);
  const reel = useMemo(() => reelOf(name, cols, style), [name, cols, style]);
  const thumb = useRef<Handle | null>(null);
  // Let go mid-scroll, the scroll carries on and another copy of the name follows in to rest by
  // `end`; hovered again on the way, it plays on from there.
  const leaving = useRef<{ end: number; brake: number; braking: boolean } | null>(null);

  useEffect(() => {
    const t = thumb.current;
    if (!t) return;
    const m = t.marquee;
    const scene = (text: string) => ({ effect: 'scroll', text, face: name, style, hex: AMBER });
    /** Puts `text` on the sign at `at` ms into its scroll, playing; the frame shown stays the same. */
    const swap = (text: string, at: number) => {
      m.setProgram([scene(text)]);
      m.restart();
      m.seek(at);
    };
    let raf = 0;
    const turn = () => {
      const at = m.pass()?.at ?? reel.from;
      const exit = leaving.current;
      // Slowing again for the last stretch, so the name lands without overshooting its rest.
      if (exit && !exit.braking && exit.end - at < exit.brake) {
        exit.braking = true;
        m.ramp(1, RAMP_MS);
      }
      if (exit && at >= exit.end) {
        leaving.current = null;
        m.ramp(1, 0);
        swap(reel.text, reel.from);
        if (!live) {
          t.play(false, reel.from);
          return;
        }
      } else if (!exit && live && at >= reel.to) m.seek(reel.from);
      raf = requestAnimationFrame(turn);
    };
    if (live) t.play(true);
    else if (!leaving.current) {
      const at = m.pass()?.at ?? reel.from;
      if (at <= reel.from) return;
      const out = exitOf(name, cols, style, reel.text, at);
      // Up from 1 over the ramp, on at `rate`, and down again covers `RAMP_MS + rate * (EXIT_MS - RAMP_MS)`.
      const rate = Math.max(1, (out.end - at - RAMP_MS) / (EXIT_MS - RAMP_MS));
      leaving.current = { end: out.end, brake: (RAMP_MS * (1 + rate)) / 2, braking: false };
      swap(out.text, at);
      m.ramp(rate, RAMP_MS);
    }
    raf = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(raf);
  }, [live, reel, name, cols, style]);

  // The sign's size in dots is all that varies by row.
  const size = {
    '--pitch': `${PITCH}px`,
    '--cols': cols + 2 * margin,
    '--rows': reel.rows + 2 * margin,
    '--metrics': `${METRICS_PX}px`,
  } as CSSProperties;
  return (
    <label
      className="compose-row compose-font-face"
      data-picked={picked || undefined}
      title={FACES[name].about}
      style={size}
      {...on}
    >
      <input type="radio" name="face" aria-label={name} checked={picked} onChange={onPick} />
      <Thumbnail
        effect="scroll"
        effects={NO_EFFECTS}
        text={reel.text}
        face={name}
        style={style}
        cols={cols}
        rows={reel.rows}
        still={reel.from}
        housing={false}
        onHandle={(t) => {
          thumb.current = t;
          leaving.current = null;
        }}
      />
      <span
        className="compose-font-metrics"
        title="Its widest glyph’s width and its letters’ height, in dots."
      >
        {FACES[name].width}×{bodyOf(name)}
      </span>
    </label>
  );
}

/** Says when the scene's letters run off the sign, and offers the height that shows all of them. */
function Fit({ setRows }: { setRows: (rows: number) => void }) {
  const state = useCompose();
  const board = useBoard();
  const scene = state.program[pickedOf(state)];
  const placed = useMemo(() => scene && placeText(board, scene.text, scene), [board, scene]);
  if (!placed || placed.cut.length === 0) return null;
  const rows = rowsToShow(board, placed.text);
  return (
    <p className="compose-warning">
      The {placed.text.face.name} letters run off this {board.rows}-row sign, so some of their dots
      don't show.{' '}
      <Button size="sm" onClick={() => setRows(rows)}>
        make the sign {rows} rows
      </Button>
    </p>
  );
}
