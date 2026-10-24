import { EFFECTS } from '@/index.js';
import { effectTitle } from '../schema.js';
import { useCompose } from '../store.js';
import { Thumbnail } from '../Thumbnail.js';
import './EffectGallery.css';
import { pickEffect } from './edit.js';

/** What a built-in's tile looks its name up in, so an effect of yours by the same name doesn't shadow it. */
const BUILT_IN = {};

/** Every effect playing at once, yours then the built-ins; picking one opens it as the picker does. */
export function EffectGallery({ onPick }: { onPick: () => void }) {
  const state = useCompose();
  const tiles = [
    ...Object.entries(state.effects).map(([name, spec]) => ({
      key: `y:${name}`,
      name,
      effects: state.effects,
      tip: `Edit ${name}.${spec.about ? ` ${spec.about}` : ''}`,
    })),
    ...Object.entries(EFFECTS).map(([name, spec]) => ({
      key: `b:${name}`,
      name,
      effects: BUILT_IN,
      tip: `Edit a copy of the built-in ${name}. ${spec.about ?? ''}`,
    })),
  ];
  return (
    <ul className="compose-gallery" aria-label="every effect">
      {tiles.map((t) => (
        <li key={t.key}>
          <button
            type="button"
            className="compose-gallery-tile"
            title={t.tip}
            onClick={() => {
              pickEffect(t.key);
              onPick();
            }}
          >
            <Thumbnail effect={t.name} effects={t.effects} />
            <span className="compose-gallery-name">{effectTitle(t.name)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
