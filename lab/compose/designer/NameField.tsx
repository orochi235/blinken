import { useEffect, useState } from 'react';
import { EFFECTS, type EffectSpec } from '@/index.js';
import { compose } from '../store.js';
import { designerEdit } from './edit.js';
import './NameField.css';

/**
 * Gives the open effect another name, which the steps playing it follow. Says false, changing
 * nothing, when the name is empty or taken.
 */
function rename(from: string, to: string): boolean {
  if (to === from) return true;
  const taken =
    !to ||
    to === '__proto__' ||
    Object.hasOwn(EFFECTS, to) ||
    Object.hasOwn(compose.get().effects, to);
  if (taken) return false;
  designerEdit((s) => {
    const { [from]: spec, ...rest } = s.effects;
    s.effects = { ...rest, [to]: { ...(spec as EffectSpec), name: to } };
    s.program = s.program.map((step) => (step.effect === from ? { ...step, effect: to } : step));
    s.editing.effect = to;
  });
  return true;
}

/** The open effect's name, edited in place; a name that is empty or taken goes back. */
export function NameField({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    if (!rename(name, draft.trim())) setDraft(name);
  };
  return (
    <input
      className="compose-name"
      type="text"
      aria-label="effect name"
      value={draft}
      size={Math.max(4, draft.length)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(name);
      }}
    />
  );
}
