import { ControlPanel, f, isAuto, resolveConfigSchema } from '@weasel-js/labkit';
import { MotifFrame } from '@weasel-js/ui';
import { useMemo } from 'react';
import { EFFECTS } from '@/index.js';
import { Panel } from '../Panel.js';
import { DENSITY, effectTitle, hexOf, numberField, numOf } from '../schema.js';
import { HOLD, withLook } from '../state.js';
import { compose, pickedOf, playEffect, useCompose, useEffects } from '../store.js';
import { SceneLayers } from './SceneLayers.js';
import { SceneTuning } from './SceneTuning.js';
import './SceneEditor.css';

const NONE: ReadonlySet<string> = new Set();
const OWN_HOLD: ReadonlySet<string> = new Set(['hold']);

/** The scene panel's frame: the color its message lights in. */
const tintOf = (hex: number) =>
  ({ space: 'srgb', coords: [16, 8, 0].map((s) => ((hex >> s) & 0xff) / 255) }) as const;

/** The picked scene's own panel: its message and how it plays, and its layers; its face is the font panel's. */
export function SceneEditor() {
  const state = useCompose();
  const at = pickedOf(state);
  const scene = state.program[at];
  const effects = useEffects();
  const names = [
    ...Object.keys(effects),
    ...Object.keys(EFFECTS).filter((n) => !Object.hasOwn(effects, n)),
  ];
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
          monospace: f
            .boolean(false)
            .label('monospace')
            .describe(
              'Gives every letter the same width, the face’s widest, as on a fixed-pitch sign. Off, each letter takes its own width, so narrow letters like I sit closer to their neighbors.',
            ),
        }),
      ),
    [key],
  );
  if (!scene) return null;

  const set = (path: string, v: unknown) => {
    if (path === 'effect') {
      playEffect(String(v));
      return;
    }
    compose.edit(
      (s) => {
        const was = s.program[at];
        if (!was) return;
        if (path === 'monospace') s.program[at] = withLook(was, 'monospace', v === true);
        else if (path === 'text') s.program[at] = { ...was, text: String(v) || ' ' };
        else if (path === 'color') s.program[at] = { ...was, hex: numOf(String(v)) };
        else if (isAuto(v)) {
          const { hold: _, ...rest } = was;
          s.program[at] = rest;
        } else s.program[at] = { ...was, hold: Number(v) };
      },
      { replay: at },
    );
  };

  return (
    <Panel title={`scene ${at + 1}`} className="compose-scene-editor" tint={tintOf(scene.hex)}>
      <MotifFrame kind="subpanel" title="message" className="compose-scene-part">
        <ControlPanel
          schema={schema}
          config={{
            text: scene.text,
            color: hexOf(scene.hex),
            effect: String(scene.effect),
            hold: scene.hold ?? 3000,
            monospace: scene.style?.monospace === true,
          }}
          auto={scene.hold === undefined ? OWN_HOLD : NONE}
          setConfig={set}
          draftConfig={set}
          density={DENSITY}
        />
      </MotifFrame>
      <MotifFrame
        kind="subpanel"
        title={`${effectTitle(String(scene.effect))} settings`}
        className="compose-scene-part"
      >
        <SceneTuning />
      </MotifFrame>
      <MotifFrame kind="subpanel" title="layers" className="compose-scene-part">
        <SceneLayers />
      </MotifFrame>
    </Panel>
  );
}
