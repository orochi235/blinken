import { EFFECTS } from '@/index.js';
import { useLibrary } from '../library.js';
import { PlainSelect } from '../PlainSelect.js';
import { effectTitle } from '../schema.js';
import { newEffect, openEffect } from './edit.js';
import { useDesk } from './open.js';

/** Opens one of the library's effects, a built-in (copied on its first edit), or a fresh one. */
export function EffectPicker() {
  const designer = useDesk();
  const yours = Object.keys(useLibrary());
  const options = [
    ...(yours.length
      ? [
          {
            title: 'library',
            options: yours.map((n) => ({ value: `y:${n}`, label: effectTitle(n) })),
          },
        ]
      : []),
    {
      title: 'built-in, copied when changed',
      options: Object.keys(EFFECTS).map((n) => ({ value: `b:${n}`, label: effectTitle(n) })),
    },
    { title: 'start', options: [{ value: 'n:', label: 'new effect' }] },
  ];
  const open = designer.open();
  return (
    <PlainSelect
      aria-label="effect"
      placeholder="pick an effect…"
      options={options}
      selectedKey={open === undefined ? null : yours.includes(open) ? `y:${open}` : `b:${open}`}
      onSelectionChange={(key) => {
        const k = String(key);
        if (k === 'n:') newEffect(designer);
        else openEffect(designer, k.slice(2));
      }}
    />
  );
}
