import { LabShell, localStorageAdapter, Persistence } from '@weasel-js/labkit';
import '../compose/App.css';
import { DesignerPanel } from '../compose/designer/DesignerPanel.js';
import { EffectDiagram } from '../compose/designer/EffectDiagram.js';
import { designer, useDesk } from '../compose/designer/open.js';
import { SIGN_RECORDS } from '../compose/hardware.js';
import { PAGES } from '../pages.js';
import './App.css';
import { LibraryBar } from './LibraryBar.js';
import { LibraryPanel } from './LibraryPanel.js';
import { PreviewPanel, PreviewPlayback } from './PreviewPanel.js';

/** The diagram, mounted afresh for each effect opened, so each starts in its default view. */
function OpenDiagram() {
  useDesk();
  return <EffectDiagram key={designer.open() ?? ''} />;
}

/**
 * The effects page: the library down one side, and the open effect playing over its diagram, with
 * its designer beside them where the window is wide enough and under them where it is not.
 */
export function App() {
  return (
    <LabShell title="blinken effects" mode="dark" pages={PAGES} header={<LibraryBar />}>
      {/* compose's records, for the sign's hardware the two pages share. */}
      <Persistence storageKey={SIGN_RECORDS} storage={localStorageAdapter}>
        <div className="effects-panes">
          <div className="compose-pane">
            <LibraryPanel />
          </div>
          <div className="compose-pane effects-stage">
            <div className="effects-watch">
              <PreviewPanel />
              <PreviewPlayback />
              <OpenDiagram />
            </div>
            <div className="effects-design">
              <DesignerPanel />
            </div>
          </div>
        </div>
      </Persistence>
    </LabShell>
  );
}
