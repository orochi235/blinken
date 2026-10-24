import { Button } from '@weasel-js/labkit';
import { Input, RangeSlider } from '@weasel-js/ui';
import { type CSSProperties, useMemo, useState } from 'react';
import {
  board,
  FACE_NAMES,
  FACES,
  type FaceName,
  MARGIN,
  placeText,
  rasterize,
  rowsToShow,
} from '@/index.js';
import { useLive } from '../live.js';
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
      <div className="compose-rows compose-font-faces" role="radiogroup" aria-label="face">
        {FACE_NAMES.filter((name) => {
          const body = bodyOf(name);
          return (
            name.includes(search.trim().toLowerCase()) &&
            body >= (heights[0] ?? SHORTEST) &&
            body <= (heights[1] ?? TALLEST)
          );
        }).map((name: FaceName) => (
          <FaceRow key={name} name={name} picked={name === face} onPick={() => set('face', name)} />
        ))}
      </div>
    </Panel>
  );
}

/** What a face's row scrolls while hovered: every letter of a word that tells faces apart. */
const SPECIMEN = 'HAMBURGEFONSTIV';
/** A face row's sign: as wide as its name and as tall as the face's rows, the specimen's included. */
const signOf = (name: FaceName) => {
  const cols = rasterize(name, { face: name }).cols + 2;
  const at = board(cols, FACES[name].rows);
  const rows = Math.max(
    rowsToShow(at, rasterize(name, { face: name })),
    rowsToShow(at, rasterize(SPECIMEN, { face: name })),
  );
  return { cols, rows };
};

/** A face's row: its name set in it, still, and the specimen scrolling across while hovered. */
function FaceRow({
  name,
  picked,
  onPick,
}: {
  name: FaceName;
  picked: boolean;
  onPick: () => void;
}) {
  const { live, on } = useLive();
  const { cols, rows } = useMemo(() => signOf(name), [name]);
  // The sign's size in dots is all that varies by face; the pitch is the stylesheet's.
  const size = { '--cols': cols + 2 * MARGIN, '--rows': rows + 2 * MARGIN } as CSSProperties;
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
        effect={live ? 'scroll' : STILL}
        effects={NO_EFFECTS}
        text={live ? SPECIMEN : name}
        face={name}
        cols={cols}
        rows={rows}
        still={live ? undefined : 100}
      />
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
