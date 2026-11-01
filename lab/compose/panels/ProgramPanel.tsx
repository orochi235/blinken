import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { AMBER, cssOf, type Scene } from '@/index.js';
import { sceneAt, watchPass } from '../clock.js';
import { IconButton } from '../IconButton.js';
import { Panel } from '../Panel.js';
import { ScenePreview } from '../ScenePreview.js';
import { effectTitle } from '../schema.js';
import { moveScene } from '../state.js';
import { compose, pickedOf, useCompose } from '../store.js';
import '../Row.css';
import './ProgramPanel.css';

/** Reshapes the list, keeping `keep` picked wherever it lands, and opens its effect. */
const reshape = (next: Scene[], keep?: Scene) =>
  compose.edit(
    (s) => {
      const held = keep ?? s.program[pickedOf(s)];
      const at = held ? next.indexOf(held) : -1;
      s.editing.scene = at >= 0 ? at : Math.min(pickedOf(s), next.length - 1);
      s.program = next;
    },
    { replay: 'picked' },
  );

/** The program: its scenes in order, and the picked one's editor. */
export function ProgramPanel() {
  const state = useCompose();
  const [thumbs, setThumbs] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);
  // The row being dragged, and where a drop would put it: before the row at `to`, or at the end.
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const drop = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    const at = to > from ? to - 1 : to;
    if (at !== from) reshape(moveScene(state.program, from, at - from), state.program[from]);
  };
  const picked = pickedOf(state);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const pick = (i: number) =>
    compose.edit(
      (s) => {
        s.editing.scene = i;
      },
      { replay: 'picked' },
    );
  const remove = (i: number) => {
    if (state.program.length < 2) return;
    reshape(state.program.filter((_, j) => j !== i));
  };

  // The playing scene's row fills behind its content as the scene plays, read off the sign's pass.
  useEffect(
    () =>
      watchPass(compose, (pass) => {
        const now = pass && sceneAt(pass);
        const playing = now ? compose.sceneOf(now) : -1;
        const done = now && pass ? Math.min(1, (pass.at - now.start) / now.ms) : 0;
        rows.current.forEach((row, i) => {
          row?.style.setProperty('--progress', i === playing ? done.toFixed(4) : '0');
        });
      }),
    [],
  );
  return (
    <Panel
      title="program"
      className="compose-program"
      actions={
        <>
          <IconButton
            glyph="add"
            label="add a scene after this one"
            onClick={() => {
              const fresh: Scene = { text: 'NEW', hex: AMBER, effect: 'hold' };
              const at = picked + 1;
              reshape([...state.program.slice(0, at), fresh, ...state.program.slice(at)], fresh);
            }}
          />
          <IconButton
            glyph="image"
            label="show each scene on a small sign, which plays it while hovered"
            pressed={thumbs}
            onClick={() => setThumbs(!thumbs)}
          />
        </>
      }
    >
      <ol className="compose-rows" onPointerLeave={() => setHovered(null)}>
        {state.program.map((scene, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: a scene is its place in the program
            key={i}
            className={[
              'compose-scene',
              drag?.from === i && 'is-dragged',
              drag && drag.to === i && 'is-drop-before',
              drag && drag.to === i + 1 && i === state.program.length - 1 && 'is-drop-after',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(i));
              setDrag({ from: i, to: i });
            }}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              const box = e.currentTarget.getBoundingClientRect();
              const to = e.clientY > box.top + box.height / 2 ? i + 1 : i;
              if (to !== drag.to) setDrag({ ...drag, to });
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop();
            }}
            onDragEnd={() => setDrag(null)}
          >
            <button
              ref={(el) => {
                rows.current[i] = el;
              }}
              type="button"
              className="compose-row compose-scene-pick"
              data-picked={i === picked || undefined}
              aria-pressed={i === picked}
              aria-label={`scene ${i + 1}: ${scene.text}, ${effectTitle(String(scene.effect))}`}
              title="Edit this scene. ↑ and ↓ pick the next one, Option-↑ and Option-↓ move this one, and Delete removes it."
              onClick={() => pick(i)}
              onKeyDown={(e) => {
                const by = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
                if (e.key === 'Delete' || e.key === 'Backspace') remove(i);
                else if (by && e.altKey) reshape(moveScene(state.program, i, by), scene);
                else if (by && rows.current[i + by]) pick(i + by);
                else return;
                e.preventDefault();
                // Rows are keyed by place, so focus follows the pick to wherever it landed.
                requestAnimationFrame(() => rows.current[pickedOf(compose.get())]?.focus());
              }}
            >
              <span
                className="compose-scene-dot"
                // A scene's own color has no class to name it; the custom property is all that varies.
                style={{ '--scene-color': cssOf(scene.hex) } as CSSProperties}
              />
              {thumbs ? (
                <ScenePreview scene={scene} effects={state.effects} live={hovered === i} />
              ) : (
                <span className="compose-scene-text">{scene.text}</span>
              )}
              <span className="compose-scene-effect">{effectTitle(String(scene.effect))}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="compose-scene-tools">
        <IconButton
          glyph="up"
          label="move this scene up"
          disabled={picked === 0}
          onClick={() => reshape(moveScene(state.program, picked, -1))}
        />
        <IconButton
          glyph="down"
          label="move this scene down"
          disabled={picked === state.program.length - 1}
          onClick={() => reshape(moveScene(state.program, picked, 1))}
        />
        <IconButton
          glyph="remove"
          label="remove this scene"
          disabled={state.program.length < 2}
          onClick={() => remove(picked)}
        />
      </div>
    </Panel>
  );
}
