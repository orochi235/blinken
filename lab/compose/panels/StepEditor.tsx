import { ControlPanel, f, isAuto, resolveConfigSchema } from '@weasel-js/labkit';
import { useMemo } from 'react';
import { EFFECTS, FACE_NAMES, FACES } from '@/index.js';
import { IconButton } from '../IconButton.js';
import { hexOf, numberField, numOf } from '../schema.js';
import { HOLD, withLook } from '../state.js';
import { compose, useCompose } from '../store.js';
import './StepEditor.css';

const NONE: ReadonlySet<string> = new Set();
const OWN_HOLD: ReadonlySet<string> = new Set(['hold']);

/** The picked step's text, color, effect, hold, face and style, with buttons to move or remove it. */
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
          text: f.string('').label('text').describe('The message this step shows on the sign.'),
          color: f
            .color('#ffffff')
            .label('color')
            .describe('The color the message lights in, unless its effect recolors it.'),
          effect: f
            .enum(names[0] ?? 'hold', names)
            .label('effect')
            .describe(
              'How the message comes on, stands, and goes: a built-in effect or one you designed.',
            ),
          hold: numberField({
            ...HOLD,
            value: 3000,
            about:
              'How long this message stands on the sign between coming on and going. Auto uses its effect’s own hold.',
          }).auto(),
          face: f
            .enum('standard', [...FACE_NAMES])
            .label('face')
            .describe(
              `The letters the message is drawn in. ${FACE_NAMES.map((n) => `${n}: ${FACES[n].about}`).join(' ')}`,
            ),
          reverse: f
            .boolean(false)
            .label('reverse')
            .describe(
              'Inverse video: the message’s box lights up and the letters show as dark dots in it.',
            ),
          proportional: f
            .boolean(false)
            .label('proportional')
            .describe(
              'Spaces each letter by its own width, so narrow letters like I sit closer to their neighbors. Off, every letter takes the same width.',
            ),
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
        else if (path === 'face' || path === 'reverse' || path === 'proportional')
          s.program[at] = withLook(was, path, v);
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
          face: typeof step.face === 'string' ? step.face : 'standard',
          reverse: step.style?.reverse === true,
          proportional: step.style?.proportional === true,
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
