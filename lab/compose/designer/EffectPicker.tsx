import { EFFECTS } from '@/index.js';
import { PlainSelect } from '../PlainSelect.js';
import { freeName } from '../state.js';
import { useCompose } from '../store.js';
import { designerEdit, openEffect } from './edit.js';

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
      selectedKey={open === undefined ? null : `y:${open}`}
      onSelectionChange={(key) => {
        const [kind, n] = [key.slice(0, 2), key.slice(2)];
        if (kind === 'y:') return openEffect(n);
        designerEdit((s) => {
          const name = freeName(s, kind === 'b:' ? `${n} copy` : 'effect');
          s.effects[name] =
            kind === 'b:'
              ? { ...EFFECTS[n as keyof typeof EFFECTS], name }
              : { name, active: [{ move: 'stand' }], hold: 2000 };
          s.editing.effect = name;
        });
      }}
    />
  );
}
