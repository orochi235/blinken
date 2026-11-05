import { Button } from '@weasel-js/labkit';
import { Input, RangeSlider } from '@weasel-js/ui';
import { type CSSProperties, useMemo, useState } from 'react';
import {
  board as boardOf,
  FACE_NAMES,
  FACES,
  type FaceName,
  marginOf,
  placeText,
  rasterize,
  rowsToShow,
  type TextStyle,
} from '@/index.js';
import { Panel } from '../Panel.js';
import { withLook } from '../state.js';
import { compose, pickedOf, useBoard, useCompose } from '../store.js';
import { NO_EFFECTS, STILL, Thumbnail } from '../Thumbnail.js';
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
  const at = pickedOf(state);
  const scene = state.program[at];
  if (!scene) return null;
  const face = typeof scene.face === 'string' ? scene.face : 'standard';
  const pick = (name: FaceName) =>
    compose.edit(
      (s) => {
        const was = s.program[at];
        if (was) s.program[at] = withLook(was, 'face', name);
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
      <div className="compose-rows compose-font-faces" role="radiogroup" aria-label="face">
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
            style={scene.style}
            picked={name === face}
            onPick={() => pick(name)}
          />
        ))}
      </div>
    </Panel>
  );
}

/** A face row's dot pitch, px: every row's dots are this size, so a row is as tall as its face. */
const PITCH = 3;
/** The width the glyph metrics take at a row's right end, px. */
const METRICS_PX = 44;

/** A face's row: its name set in it, standing still, and its glyph width and height at the right end. */
function FaceRow({
  name,
  picked,
  onPick,
  style,
}: {
  name: FaceName;
  picked: boolean;
  onPick: () => void;
  /** The picked scene's style, which every row is drawn in. */
  style?: TextStyle;
}) {
  const margin = marginOf(false);
  const { cols, rows } = useMemo(() => {
    const look = { face: name, style };
    const text = rasterize(name, look);
    return {
      cols: text.cols + 2,
      rows: rowsToShow(boardOf(text.cols + 2, FACES[name].rows, false), text),
    };
  }, [name, style]);
  // The sign's size in dots is all that varies by row.
  const size = {
    '--pitch': `${PITCH}px`,
    '--cols': cols + 2 * margin,
    '--rows': rows + 2 * margin,
    '--metrics': `${METRICS_PX}px`,
  } as CSSProperties;
  return (
    <label
      className="compose-row compose-font-face"
      data-picked={picked || undefined}
      title={FACES[name].about}
      style={size}
    >
      <input type="radio" name="face" aria-label={name} checked={picked} onChange={onPick} />
      <Thumbnail
        effect={STILL}
        effects={NO_EFFECTS}
        text={name}
        face={name}
        style={style}
        cols={cols}
        rows={rows}
        still={100}
        housing="clear"
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
