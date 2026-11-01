import { SLOTS } from '@/index.js';
import { IconButton } from '../IconButton.js';
import { shelved, useLibrary } from '../library.js';
import { Panel } from '../Panel.js';
import './DesignerPanel.css';
import { EffectPicker } from './EffectPicker.js';
import { builtinOf, deleteOpen } from './edit.js';
import { designer, useDesk } from './open.js';
import { SlotBox } from './SlotBox.js';
import { useStaged } from './staged.js';
import { WholeEffect } from './WholeEffect.js';

/**
 * The effect designer: pick an effect, or start one, and edit its pieces, hold and blend. Its
 * warnings come from staging the open effect on the preview's text.
 */
export function DesignerPanel() {
  useDesk();
  const shelf = useLibrary();
  const name = designer.open();
  const text = designer.text();
  const own = name !== undefined && Object.hasOwn(shelf, name);
  const spec = name === undefined ? undefined : own ? shelved(shelf, name) : builtinOf(name);

  const warnings = useStaged(spec, text)?.warnings ?? new Map<string, readonly string[]>();

  return (
    <Panel
      title="effect"
      className="compose-designer"
      actions={
        <>
          <EffectPicker />
          {name !== undefined && own && (
            <IconButton
              glyph="remove"
              label="take this effect out of the library; a composition playing it keeps its own copy"
              onClick={deleteOpen}
            />
          )}
          {spec?.about && <span className="compose-about">{spec.about}</span>}
        </>
      }
    >
      {name === undefined || !spec ? (
        <p className="compose-hint">
          Pick an effect to edit, or start a new one. A built-in is copied into the library when you
          first change it.
        </p>
      ) : (
        <>
          <div className="compose-whole">
            <WholeEffect name={name} spec={spec} />
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
