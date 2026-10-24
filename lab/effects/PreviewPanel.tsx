import { Input } from '@weasel-js/ui';
import { designer, useDesk } from '../compose/designer/open.js';
import { useLibrary } from '../compose/library.js';
import { Panel } from '../compose/Panel.js';
import { Thumbnail } from '../compose/Thumbnail.js';
import './PreviewPanel.css';

/** How many dots across the preview sign is: the shopfront sign's width. */
const COLS = 80;

/** The open effect looping on a sign, on text typed here, and changing as the designer does. */
export function PreviewPanel() {
  useDesk();
  const shelf = useLibrary();
  const name = designer.open();
  const text = designer.text();
  return (
    <Panel
      title="preview"
      className="effects-preview"
      actions={
        <span className="effects-preview-text" title="The message the preview plays the effect on.">
          <Input aria-label="preview text" value={text} onChange={(v) => designer.setText(v)} />
        </span>
      }
    >
      {name === undefined ? (
        <p className="compose-hint">The effect you open plays here.</p>
      ) : (
        <Thumbnail effect={name} effects={shelf} text={text || ' '} cols={COLS} />
      )}
    </Panel>
  );
}
