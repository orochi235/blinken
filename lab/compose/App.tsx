import { LabShell, localStorageAdapter, Persistence, usePersistedState } from '@weasel-js/labkit';
import { useMemo } from 'react';
import './App.css';
import { HARDWARE, type Hardware, hardwareOf } from './hardware.js';
import { FontPanel } from './panels/FontPanel.js';
import { GalleryPanel } from './panels/GalleryPanel.js';
import { HardwarePanel } from './panels/HardwarePanel.js';
import { PlaybackPanel } from './panels/PlaybackPanel.js';
import { ProgramPanel } from './panels/ProgramPanel.js';
import { SceneEditor } from './panels/SceneEditor.js';
import { ShareBar } from './panels/ShareBar.js';
import { UndoBar } from './panels/UndoBar.js';
import { Scrubber } from './Scrubber.js';
import { Sign } from './Sign.js';

/** The lab: the sign on top; under it playback and the program, the effects and the picked scene, and the sign's hardware and faces. */
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
          <PlaybackPanel />
          <ProgramPanel />
        </div>
        <div className="compose-pane compose-pane-wide">
          <GalleryPanel />
          <SceneEditor />
        </div>
        <div className="compose-pane">
          <HardwarePanel
            hardware={hardware}
            setHardware={(fn) => setKept((h) => fn(hardwareOf(h)))}
          />
          <FontPanel
            setRows={(rows) =>
              setKept((h) => {
                const now = hardwareOf(h);
                return { ...now, size: { ...now.size, rows } };
              })
            }
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
          <a
            className="compose-link"
            href="./effects.html"
            title="Design effects on a page of their own; what you save there is offered here."
          >
            effects
          </a>
        </>
      }
    >
      <Persistence storageKey="bree-compose" storage={localStorageAdapter}>
        <Compose />
      </Persistence>
    </LabShell>
  );
}
