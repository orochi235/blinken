import { LabShell } from '@weasel-js/labkit';
import '../compose/App.css';
import { DesignerPanel } from '../compose/designer/DesignerPanel.js';
import './App.css';
import { LibraryBar } from './LibraryBar.js';
import { LibraryPanel } from './LibraryPanel.js';
import { PreviewPanel } from './PreviewPanel.js';

/** The effects page: the library down one side, and the open effect playing over its designer. */
export function App() {
  return (
    <LabShell title="bree effects" mode="dark" header={<LibraryBar />}>
      <div className="effects-panes">
        <div className="compose-pane">
          <LibraryPanel />
        </div>
        <div className="compose-pane">
          <PreviewPanel />
          <DesignerPanel />
        </div>
      </div>
    </LabShell>
  );
}
