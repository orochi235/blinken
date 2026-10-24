import { LabShell, localStorageAdapter, Persistence, usePersistedState } from '@weasel-js/labkit';
import { useMemo } from 'react';
import './App.css';
import { DesignerPanel } from './designer/DesignerPanel.js';
import { HARDWARE, type Hardware, hardwareOf } from './hardware.js';
import { FontPanel } from './panels/FontPanel.js';
import { GalleryPanel } from './panels/GalleryPanel.js';
import { HardwarePanel } from './panels/HardwarePanel.js';
import { LayersPanel } from './panels/LayersPanel.js';
import { ProgramPanel } from './panels/ProgramPanel.js';
import { SceneEditor } from './panels/SceneEditor.js';
import { ShareBar } from './panels/ShareBar.js';
import { UndoBar } from './panels/UndoBar.js';
import { Scrubber } from './Scrubber.js';
import { Sign } from './Sign.js';

/** The lab: the sign on top, and under it the program, the designer, and the rest. */
function Compose() {
  // The hardware belongs to the sign, not the composition, so it stays out of drafts and links.
  const [kept, setKept] = usePersistedState<Hardware>('sign', HARDWARE, { scope: 'lab' });
  const hardware = useMemo(() => hardwareOf(kept), [kept]);
  return (
    <div className="compose">
      <Sign hardware={hardware} />
      <Scrubber />
      <div className="compose-panes">
        <div className="compose-pane">
          <ProgramPanel />
          <SceneEditor />
          <FontPanel
            setRows={(rows) =>
              setKept((h) => {
                const now = hardwareOf(h);
                return { ...now, size: { ...now.size, rows } };
              })
            }
          />
        </div>
        <div className="compose-pane compose-pane-wide">
          <GalleryPanel />
          <DesignerPanel />
          <LayersPanel />
        </div>
        <div className="compose-pane">
          <HardwarePanel
            hardware={hardware}
            setHardware={(fn) => setKept((h) => fn(hardwareOf(h)))}
          />
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <LabShell
      title="bree compose"
      mode="dark"
      header={
        <>
          <UndoBar />
          <ShareBar />
        </>
      }
    >
      <Persistence storageKey="bree-compose" storage={localStorageAdapter}>
        <Compose />
      </Persistence>
    </LabShell>
  );
}
