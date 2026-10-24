import { Button } from '@weasel-js/labkit';
import { useMemo, useState } from 'react';
import { placeText, SLOTS, type Slot, stageEffect, type Warning } from '@/index.js';
import { IconButton } from '../IconButton.js';
import { Panel } from '../Panel.js';
import { deleteEffect, FALLBACK } from '../state.js';
import { pickedOf, useBoard, useCompose } from '../store.js';
import './DesignerPanel.css';
import { EffectGallery } from './EffectGallery.js';
import { EffectPicker } from './EffectPicker.js';
import { builtinOf, designerEdit } from './edit.js';
import { NameField } from './NameField.js';
import { SlotBox } from './SlotBox.js';
import { WholeEffect } from './WholeEffect.js';

/**
 * The effect designer: pick an effect, or start one, and edit its pieces, hold and blend. Its
 * warnings come from staging the open effect on the picked scene's text.
 */
export function DesignerPanel() {
  const state = useCompose();
  const b = useBoard();
  const name = state.editing.effect;
  const own = name !== undefined && Object.hasOwn(state.effects, name);
  const spec = name === undefined ? undefined : own ? state.effects[name] : builtinOf(name);
  const scene = state.program[pickedOf(state)];
  const [browsing, setBrowsing] = useState(false);

  const warnings = useMemo(() => {
    const at = new Map<Slot | 'effect', string[]>();
    if (!spec) return at;
    let found: readonly Warning[];
    try {
      found = stageEffect(
        spec,
        placeText(b, scene?.text ?? ' ', scene),
        scene?.hex ?? 0xffffff,
      ).warnings;
    } catch (e) {
      found = [{ text: (e as Error).message }];
    }
    // A scene running off the sign is the scene editor's to say, beside the face that does it.
    for (const w of found.filter((w) => w.rows === undefined))
      at.set(w.slot ?? 'effect', [...(at.get(w.slot ?? 'effect') ?? []), w.text]);
    return at;
  }, [spec, scene, b]);

  return (
    <Panel
      title="effect"
      className="compose-designer"
      actions={
        <>
          <EffectPicker />
          <Button
            size="sm"
            variant="ghost"
            tooltip={
              browsing
                ? 'Go back to editing the open effect.'
                : 'Show every effect playing side by side, to pick one by eye.'
            }
            onClick={() => setBrowsing(!browsing)}
          >
            {browsing ? 'back' : 'browse'}
          </Button>
          {name !== undefined && own && <NameField name={name} />}
          {name !== undefined && own && (
            <IconButton
              glyph="remove"
              label={`delete this effect; scenes playing it play ${FALLBACK} instead`}
              onClick={() => designerEdit((s) => deleteEffect(s, name))}
            />
          )}
          {spec?.about && <span className="compose-about">{spec.about}</span>}
        </>
      }
    >
      {browsing || name === undefined || !spec ? (
        <>
          {!browsing && (
            <p className="compose-hint">
              Pick a scene or an effect to edit, or start a new one. A built-in is copied when you
              first change it.
            </p>
          )}
          <EffectGallery onPick={() => setBrowsing(false)} />
        </>
      ) : (
        <>
          <div className="compose-whole">
            <WholeEffect spec={spec} />
            {(warnings.get('effect') ?? []).map((w) => (
              <p key={w} className="compose-warning">
                {w}
              </p>
            ))}
          </div>
          {SLOTS.map((slot) => (
            <SlotBox key={slot} slot={slot} spec={spec} warnings={warnings.get(slot) ?? []} />
          ))}
        </>
      )}
    </Panel>
  );
}
