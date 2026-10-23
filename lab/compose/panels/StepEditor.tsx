import { ControlPanel, f, isAuto, resolveConfigSchema } from '@weasel-js/labkit';
import { useMemo } from 'react';
import { EFFECTS } from '@/index.js';
import { IconButton } from '../IconButton.js';
import { hexOf, numberField, numOf } from '../schema.js';
import { HOLD } from '../state.js';
import { compose, useCompose } from '../store.js';
import './StepEditor.css';

const NONE: ReadonlySet<string> = new Set();
const OWN_HOLD: ReadonlySet<string> = new Set(['hold']);

/** The picked step's text, color, effect and hold, with buttons to move or remove it. */
export function StepEditor({
  at,
  onMove,
  onRemove,
}: {
  at: number;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const state = useCompose();
  const step = state.program[at];
  const names = [...Object.keys(state.effects), ...Object.keys(EFFECTS)];
  const key = names.join('\n');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `names`
  const schema = useMemo(
    () =>
      resolveConfigSchema(
        f.schema({
          text: f.string('').label('text'),
          color: f.color('#ffffff').label('color'),
          effect: f.enum(names[0] ?? 'hold', names).label('effect'),
          hold: numberField({ ...HOLD, value: 3000 })
            .auto()
            .describe('auto plays for its effect’s own hold'),
        }),
      ),
    [key],
  );
  if (!step) return null;

  const set = (path: string, v: unknown) =>
    compose.edit(
      (s) => {
        const was = s.program[at];
        if (!was) return;
        if (path === 'text') s.program[at] = { ...was, text: String(v) || ' ' };
        else if (path === 'color') s.program[at] = { ...was, hex: numOf(String(v)) };
        else if (path === 'effect') s.program[at] = { ...was, effect: String(v) };
        else if (isAuto(v)) {
          const { hold: _, ...rest } = was;
          s.program[at] = rest;
        } else s.program[at] = { ...was, hold: Number(v) };
      },
      path === 'effect' ? { follow: true } : { replay: at },
    );

  const last = state.program.length - 1;
  return (
    <div className="compose-step-editor">
      <ControlPanel
        title={`step ${at + 1}`}
        schema={schema}
        config={{
          text: step.text,
          color: hexOf(step.hex),
          effect: String(step.effect),
          hold: step.hold ?? 3000,
        }}
        auto={step.hold === undefined ? OWN_HOLD : NONE}
        setConfig={set}
        draftConfig={set}
        density="tight"
      />
      <div className="compose-step-tools">
        <IconButton
          glyph="up"
          label="move this step up"
          disabled={at === 0}
          onClick={() => onMove(-1)}
        />
        <IconButton
          glyph="down"
          label="move this step down"
          disabled={at === last}
          onClick={() => onMove(1)}
        />
        <IconButton
          glyph="remove"
          label="remove this step"
          disabled={last === 0}
          onClick={onRemove}
        />
      </div>
    </div>
  );
}
