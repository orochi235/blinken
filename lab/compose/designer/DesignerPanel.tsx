import { useMemo } from 'react';
import { board, placeText, SIZE, SLOTS, type Slot, stageEffect, type Warning } from '@/index.js';
import { IconButton } from '../IconButton.js';
import { deleteEffect, FALLBACK } from '../state.js';
import { pickedOf, useCompose } from '../store.js';
import './DesignerPanel.css';
import { EffectPicker } from './EffectPicker.js';
import { designerEdit } from './edit.js';
import { NameField } from './NameField.js';
import { SlotBox } from './SlotBox.js';
import { WholeEffect } from './WholeEffect.js';

/** The board the lab's sign is: the marquee's default size. */
const BOARD = board(SIZE.cols, SIZE.rows);

/**
 * The effect designer: pick an effect, or start one, and edit its pieces, hold and blend. Its
 * warnings come from staging the open effect on the picked step's text.
 */
export function DesignerPanel() {
  const state = useCompose();
  const name = state.editing.effect;
  const spec = name === undefined ? undefined : state.effects[name];
  const step = state.program[pickedOf(state)];

  const warnings = useMemo(() => {
    const at = new Map<Slot | 'effect', string[]>();
    if (!spec) return at;
    let found: readonly Warning[];
    try {
      found = stageEffect(
        spec,
        placeText(BOARD, step?.text ?? ' '),
        step?.hex ?? 0xffffff,
      ).warnings;
    } catch (e) {
      found = [{ text: (e as Error).message }];
    }
    for (const w of found)
      at.set(w.slot ?? 'effect', [...(at.get(w.slot ?? 'effect') ?? []), w.text]);
    return at;
  }, [spec, step]);

  return (
    <section className="compose-designer" aria-label="effect">
      <header className="compose-designer-head">
        <h2 className="compose-heading">effect</h2>
        <EffectPicker />
        {name !== undefined && spec && <NameField name={name} />}
        {name !== undefined && spec && (
          <IconButton
            glyph="remove"
            label={`delete this effect; steps playing it play ${FALLBACK} instead`}
            onClick={() => designerEdit((s) => deleteEffect(s, name))}
          />
        )}
        {spec?.about && <span className="compose-about">{spec.about}</span>}
      </header>
      {name === undefined || !spec ? (
        <p className="compose-hint">
          Pick an effect to edit, or start a new one. A built-in opens as a copy.
        </p>
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
    </section>
  );
}
