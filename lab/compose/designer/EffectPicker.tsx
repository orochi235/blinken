import { EFFECTS } from '@/index.js';
import { PlainSelect } from '../PlainSelect.js';
import { useCompose } from '../store.js';
import { pickEffect } from './edit.js';

/** Opens one of your effects, a copy of a built-in, or a fresh one. */
export function EffectPicker() {
  const state = useCompose();
  const yours = Object.keys(state.effects);
  const options = [
    ...(yours.length
      ? [{ title: 'yours', options: yours.map((n) => ({ value: `y:${n}`, label: n })) }]
      : []),
    {
      title: 'built-in, as a copy',
      options: Object.keys(EFFECTS).map((n) => ({ value: `b:${n}`, label: n })),
    },
    { title: 'start', options: [{ value: 'n:', label: 'new effect' }] },
  ];
  const open = state.editing.effect;
  return (
    <PlainSelect
      aria-label="effect"
      placeholder="pick an effect…"
      options={options}
      selectedKey={
        open === undefined ? null : Object.hasOwn(state.effects, open) ? `y:${open}` : `b:${open}`
      }
      onSelectionChange={(key) => pickEffect(String(key))}
    />
  );
}
