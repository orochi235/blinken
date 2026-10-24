import { Button } from '@weasel-js/labkit';
import { Input, RangeSlider } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import { FACE_NAMES, FACES, type FaceName, placeText, rasterize, rowsToShow } from '@/index.js';
import { Panel } from '../Panel.js';
import { withLook } from '../state.js';
import { compose, pickedOf, useBoard, useCompose } from '../store.js';
import { NO_EFFECTS, STILL, Thumbnail } from '../Thumbnail.js';
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
  const preview = scene.text.trim().slice(0, 12) || 'OPEN';
  const set = (what: 'face' | 'reverse' | 'proportional', v: unknown) =>
    compose.edit(
      (s) => {
        const was = s.program[at];
        if (was) s.program[at] = withLook(was, what, v);
      },
      { replay: at },
    );
  return (
    <Panel title="font" className="compose-font">
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
      </div>
      <div
        className="compose-font-filter"
        title="Narrow the faces by name, and by how many rows tall their letters are."
      >
        <Input
          aria-label="find a face"
          placeholder="find a face"
          value={search}
          onChange={setSearch}
        />
        <RangeSlider
          label="height"
          minValue={SHORTEST}
          maxValue={TALLEST}
          step={1}
          value={heights}
          onChange={(v) => setHeights(Array.isArray(v) ? v : [v, v])}
          formatOutput={(v) => (Array.isArray(v) ? `${v[0]}–${v[1]} rows` : `${v} rows`)}
        />
      </div>
      <div className="compose-font-faces" role="radiogroup" aria-label="face">
        {FACE_NAMES.filter((name) => {
          const body = bodyOf(name);
          return (
            name.includes(search.trim().toLowerCase()) &&
            body >= (heights[0] ?? SHORTEST) &&
            body <= (heights[1] ?? TALLEST)
          );
        }).map((name: FaceName) => (
          <label key={name} className="compose-font-face" title={FACES[name].about}>
            <input
              type="radio"
              name="face"
              checked={name === face}
              onChange={() => set('face', name)}
            />
            <span className="compose-font-name">{name}</span>
            <Thumbnail
              effect={STILL}
              effects={NO_EFFECTS}
              text={preview}
              face={name}
              cols={rasterize(preview, { face: name }).cols + 2}
              still={100}
            />
          </label>
        ))}
      </div>
    </Panel>
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
