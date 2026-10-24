import { Button } from '@weasel-js/labkit';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { Step } from '@/index.js';
import { AMBER } from '../../demo.js';
import { stepAt, watchPass } from '../clock.js';
import { hexOf } from '../schema.js';
import { moveStep } from '../state.js';
import { compose, pickedOf, useCompose } from '../store.js';
import './ProgramPanel.css';
import { StepEditor } from './StepEditor.js';

/** Reshapes the list, keeping `keep` picked wherever it lands, and opens its effect. */
const reshape = (next: Step[], keep?: Step) =>
  compose.edit(
    (s) => {
      const held = keep ?? s.program[pickedOf(s)];
      const at = held ? next.indexOf(held) : -1;
      s.editing.step = at >= 0 ? at : Math.min(pickedOf(s), next.length - 1);
      s.program = next;
    },
    { follow: true },
  );

/** The program: its steps in order, and the picked one's editor. */
export function ProgramPanel() {
  const state = useCompose();
  const [solo, setSolo] = useState(false);
  const picked = pickedOf(state);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  // The playing step's row fills behind its content as the step plays, read off the sign's pass.
  useEffect(
    () =>
      watchPass((pass) => {
        const now = pass && stepAt(pass);
        const playing = now ? compose.stepOf(now) : -1;
        const done = now && pass ? Math.min(1, (pass.at - now.start) / now.ms) : 0;
        rows.current.forEach((row, i) => {
          row?.style.setProperty('--progress', i === playing ? done.toFixed(4) : '0');
        });
      }),
    [],
  );
  return (
    <section className="compose-program" aria-label="program">
      <header className="compose-program-head">
        <h2 className="compose-heading">program</h2>
        <Button
          size="sm"
          onClick={() => {
            const fresh: Step = { text: 'NEW', hex: AMBER, effect: 'hold' };
            const at = picked + 1;
            reshape([...state.program.slice(0, at), fresh, ...state.program.slice(at)], fresh);
          }}
        >
          add step
        </Button>
        <label
          className="compose-check"
          title="Loop the step you are editing on its own, instead of playing the whole program."
        >
          <input
            type="checkbox"
            checked={solo}
            onChange={(e) => {
              setSolo(e.target.checked);
              compose.setSolo(e.target.checked);
            }}
          />
          solo
        </label>
        <Button
          size="sm"
          tooltip="Play the program again from the step you are editing."
          onClick={compose.restart}
        >
          restart
        </Button>
      </header>
      <ol className="compose-steps">
        {state.program.map((step, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a step is its place in the program
          <li key={i} className={i === picked ? 'compose-step is-picked' : 'compose-step'}>
            <button
              ref={(el) => {
                rows.current[i] = el;
              }}
              type="button"
              className="compose-step-pick"
              aria-pressed={i === picked}
              title="edit this step"
              onClick={() =>
                compose.edit(
                  (s) => {
                    s.editing.step = i;
                  },
                  { follow: true },
                )
              }
            >
              <span
                className="compose-step-dot"
                // A step's own color has no class to name it; the custom property is all that varies.
                style={{ '--step-color': hexOf(step.hex) } as CSSProperties}
              />
              <span className="compose-step-text">{step.text}</span>
              <span className="compose-step-effect">{String(step.effect)}</span>
            </button>
          </li>
        ))}
      </ol>
      <StepEditor
        at={picked}
        onMove={(by) => reshape(moveStep(state.program, picked, by))}
        onRemove={() => reshape(state.program.filter((_, j) => j !== picked))}
      />
    </section>
  );
}
