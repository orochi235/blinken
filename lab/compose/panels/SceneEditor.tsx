import { ControlPanel, f, isAuto, resolveConfigSchema } from '@weasel-js/labkit';
import { useMemo } from 'react';
import { EFFECTS } from '@/index.js';
import { DENSITY, effectTitle, hexOf, numberField, numOf } from '../schema.js';
import { HOLD } from '../state.js';
import { compose, useCompose } from '../store.js';
import './SceneEditor.css';

const NONE: ReadonlySet<string> = new Set();
const OWN_HOLD: ReadonlySet<string> = new Set(['hold']);

/** The picked scene's text, color, effect and hold; its face and style are the font panel's. */
export function SceneEditor({ at }: { at: number }) {
  const state = useCompose();
  const scene = state.program[at];
  const names = [...Object.keys(state.effects), ...Object.keys(EFFECTS)];
  const key = names.join('\n');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `names`
  const schema = useMemo(
    () =>
      resolveConfigSchema(
        f.schema({
          text: f.string('').label('text').describe('The message this scene shows on the sign.'),
          color: f
            .color('#ffffff')
            .label('color')
            .describe('The color the message lights in, unless its effect recolors it.'),
          effect: f
            .enum(names[0] ?? 'hold', names)
            .labels(names.map((n) => ({ value: n, label: effectTitle(n) })))
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
        }),
      ),
    [key],
  );
  if (!scene) return null;

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

  return (
    <div className="compose-scene-editor">
      <ControlPanel
        title={`scene ${at + 1}`}
        schema={schema}
        config={{
          text: scene.text,
          color: hexOf(scene.hex),
          effect: String(scene.effect),
          hold: scene.hold ?? 3000,
        }}
        auto={scene.hold === undefined ? OWN_HOLD : NONE}
        setConfig={set}
        draftConfig={set}
        density={DENSITY}
      />
    </div>
  );
}
