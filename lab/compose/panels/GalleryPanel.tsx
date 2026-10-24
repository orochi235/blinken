import { type GalleryTile, useGalleryTiles } from '../designer/EffectGallery.js';
import { pickEffect } from '../designer/edit.js';
import { useLive } from '../live.js';
import { Panel } from '../Panel.js';
import { effectTitle } from '../schema.js';
import { MIDWAY, Thumbnail } from '../Thumbnail.js';
import './GalleryPanel.css';

/** Every effect in one scrolling strip, each held still until hovered; picking one opens it. */
export function GalleryPanel() {
  const tiles = useGalleryTiles();
  return (
    <Panel title="effects" className="compose-strip">
      <ul className="compose-strip-tiles" aria-label="every effect">
        {tiles.map((t) => (
          <li key={t.key}>
            <StripTile tile={t} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function StripTile({ tile }: { tile: GalleryTile }) {
  const { live, on } = useLive();
  return (
    <button
      type="button"
      className="compose-strip-tile"
      title={tile.tip}
      onClick={() => pickEffect(tile.key)}
      {...on}
    >
      <Thumbnail effect={tile.name} effects={tile.effects} still={live ? undefined : MIDWAY} />
      <span className="compose-strip-name">{effectTitle(tile.name)}</span>
    </button>
  );
}
