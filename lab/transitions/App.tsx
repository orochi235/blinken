import { LabShell } from '@weasel-js/labkit';
import { PAGES } from '../pages.js';
import { UndoBar } from '../shell/UndoBar.js';
import { useTransitions, useTransitionsStore } from './context.js';
import { Editor } from './Editor.js';
import { Library } from './Library.js';
import { Stage } from './Stage.js';
import { recipeNamed, STAGE_TYPES } from './store.js';
import './controls.css';
import './App.css';

/** What the stage plays on: the type, its cells, the two values and the color. */
function StageBar() {
  const transitions = useTransitionsStore();
  const { stage } = useTransitions();
  return (
    <div className="tr-bar">
      <label className="tr-field">
        type
        <select
          value={stage.type}
          onChange={(e) => transitions.setStage({ type: e.target.value as typeof stage.type })}
        >
          {STAGE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="tr-field">
        cells
        <input
          type="number"
          min={1}
          max={24}
          value={stage.cells}
          onChange={(e) =>
            transitions.setStage(
              { cells: Math.min(24, Math.max(1, Number(e.target.value) || 1)) },
              'cells',
            )
          }
        />
      </label>
      <label className="tr-field">
        from
        <input
          value={stage.from}
          spellCheck={false}
          onChange={(e) => transitions.setStage({ from: e.target.value }, 'from')}
        />
      </label>
      <label className="tr-field">
        to
        <input
          value={stage.to}
          spellCheck={false}
          onChange={(e) => transitions.setStage({ to: e.target.value }, 'to')}
        />
      </label>
      <input
        type="color"
        aria-label="color"
        value={stage.color}
        onChange={(e) => transitions.setStage({ color: e.target.value }, 'color')}
      />
    </div>
  );
}

/** The transitions page: the library, the open transition playing, and its settings. */
export function App() {
  const transitions = useTransitionsStore();
  const { open, saved, stage } = useTransitions();
  const recipe = recipeNamed(open, saved);
  return (
    <LabShell
      title="blinken transitions"
      mode="dark"
      pages={PAGES}
      header={<UndoBar target={transitions} />}
    >
      <div className="tr-page">
        <Library />
        <section className="tr-middle">
          <StageBar />
          <Stage recipe={recipe} stage={stage} />
        </section>
        <Editor recipe={recipe} />
      </div>
    </LabShell>
  );
}
