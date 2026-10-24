import { newEffect, openEffect } from '../compose/designer/edit.js';
import { designer, useDesk } from '../compose/designer/open.js';
import { IconButton } from '../compose/IconButton.js';
import { useLibrary } from '../compose/library.js';
import { useLive } from '../compose/live.js';
import { Panel } from '../compose/Panel.js';
import { effectTitle } from '../compose/schema.js';
import { Thumbnail } from '../compose/Thumbnail.js';
import { type EffectTile, tilesOf } from '../compose/tiles.js';
import '../compose/Row.css';
import './LibraryPanel.css';

/** Every effect, the library's then the built-ins, each opening in the designer when picked. */
export function LibraryPanel() {
  useDesk();
  const tiles = tilesOf(useLibrary());
  const open = designer.open();
  return (
    <Panel
      title="library"
      className="effects-library"
      actions={
        <IconButton glyph="add" label="start a new effect in the library" onClick={newEffect} />
      }
    >
      <ul className="compose-rows">
        {tiles.map((t) => (
          <li key={t.key}>
            <LibraryRow tile={t} open={t.name === open} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** One effect: its name over a small sign held on its telling moment, playing it while hovered. */
function LibraryRow({ tile, open }: { tile: EffectTile; open: boolean }) {
  const { live, on } = useLive();
  return (
    <button
      type="button"
      className="compose-row effects-library-row"
      data-picked={open || undefined}
      aria-pressed={open}
      title={`${tile.builtin ? 'A built-in, copied into the library when you first change it.' : 'In the library.'}${tile.about ? ` ${tile.about}` : ''}`}
      onClick={() => openEffect(tile.name)}
      {...on}
    >
      <span className="effects-library-name">
        {effectTitle(tile.name)}
        {tile.builtin && <span className="compose-about"> built-in</span>}
      </span>
      <Thumbnail effect={tile.name} effects={tile.effects} still="action" playing={live} rewind />
    </button>
  );
}
