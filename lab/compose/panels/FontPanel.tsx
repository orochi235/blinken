import { Button } from '@weasel-js/labkit';
import { useMemo } from 'react';
import {
  type EffectSpec,
  FACE_NAMES,
  FACES,
  type FaceName,
  placeText,
  rasterize,
  rowsToShow,
} from '@/index.js';
import { withLook } from '../state.js';
import { compose, pickedOf, useBoard, useCompose } from '../store.js';
import { Thumbnail } from '../Thumbnail.js';
import './FontPanel.css';

/** The message standing still, so a preview shows the letters rather than an effect. */
const STILL: EffectSpec = { name: 'still', active: { move: 'stand' } };
const NO_EFFECTS = {};

/** The picked scene's face, each one previewed on its text, and its style. */
export function FontPanel({ setRows }: { setRows: (rows: number) => void }) {
  const state = useCompose();
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
    <section className="compose-font" aria-label="font">
      <h2 className="compose-heading">font</h2>
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
      <div className="compose-font-faces" role="radiogroup" aria-label="face">
        {FACE_NAMES.map((name: FaceName) => (
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
    </section>
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
