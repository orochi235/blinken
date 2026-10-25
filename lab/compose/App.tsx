import {
  LabShell,
  localStorageAdapter,
  Persistence,
  Split,
  usePersistedState,
} from '@weasel-js/labkit';
import { useSyncExternalStore } from 'react';
import { PAGES } from '../pages.js';
import './App.css';
import { SIGN_RECORDS, useHardware } from './hardware.js';
import { FontPanel } from './panels/FontPanel.js';
import { GalleryPanel } from './panels/GalleryPanel.js';
import { HardwarePanel } from './panels/HardwarePanel.js';
import { PlaybackPanel } from './panels/PlaybackPanel.js';
import { ProgramPanel } from './panels/ProgramPanel.js';
import { SceneEditor } from './panels/SceneEditor.js';
import { ShareBar } from './panels/ShareBar.js';
import { UndoBar } from './panels/UndoBar.js';
import { type SceneLook, Scrubber } from './Scrubber.js';
import { Sign } from './Sign.js';
import { compose, playing, useCompose } from './store.js';

/** The side columns' widths, px, until they are dragged. */
const PANES = { left: 300, right: 320 };
/** How narrow a drag may make each column, px. */
const LEFT_MIN = 240;
const MIDDLE_MIN = 360;
const RIGHT_MIN = 260;
/** Too narrow for every column's minimum, they stack, each scrolling in its share of the height. */
const NARROW = `(max-width: ${LEFT_MIN + MIDDLE_MIN + RIGHT_MIN + 24}px)`;

const narrowQuery = () => window.matchMedia(NARROW);
const useNarrow = () =>
  useSyncExternalStore(
    (on) => {
      const q = narrowQuery();
      q.addEventListener('change', on);
      return () => q.removeEventListener('change', on);
    },
    () => narrowQuery().matches,
  );

/** The scrubber over the program, each scene in its own text and color. */
function ProgramScrubber() {
  const { program } = useCompose();
  const look: SceneLook = (s) => program[compose.sceneOf(s)];
  return <Scrubber player={compose} look={look} />;
}

/** The lab: the sign on top; under it playback and the program, the effects and the picked scene, and the sign's hardware and faces. */
function Compose() {
  const [hardware, setHardware] = useHardware();
  const [widths, setWidths] = usePersistedState('panes', PANES, { scope: 'lab' });
  const narrow = useNarrow();
  const left = (
    <>
      <PlaybackPanel />
      <ProgramPanel />
    </>
  );
  const middle = (
    <>
      <GalleryPanel />
      <SceneEditor />
    </>
  );
  const right = (
    <>
      <HardwarePanel hardware={hardware} setHardware={setHardware} />
      <FontPanel setRows={(rows) => setHardware((h) => ({ ...h, size: { ...h.size, rows } }))} />
    </>
  );
  return (
    <div className="compose">
      <Sign
        hardware={hardware}
        program={playing}
        effects={() => compose.get().effects}
        onSign={compose.attach}
      />
      <ProgramScrubber />
      <div className="compose-columns" data-stacked={narrow || undefined}>
        {narrow ? (
          <>
            <div className="compose-pane">{left}</div>
            <div className="compose-pane">{middle}</div>
            <div className="compose-pane">{right}</div>
          </>
        ) : (
          <Split
            className="compose-panes"
            label="playback and program"
            sidebarClassName="compose-pane"
            contentClassName="compose-panes-rest"
            width={widths.left}
            defaultWidth={PANES.left}
            minWidth={LEFT_MIN}
            contentMinWidth={MIDDLE_MIN + RIGHT_MIN}
            onWidthChange={(w) => setWidths((was) => ({ ...was, left: w }))}
            sidebar={left}
          >
            <Split
              className="compose-panes"
              side="end"
              label="sign and font"
              sidebarClassName="compose-pane"
              contentClassName="compose-pane"
              width={widths.right}
              defaultWidth={PANES.right}
              minWidth={RIGHT_MIN}
              contentMinWidth={MIDDLE_MIN}
              onWidthChange={(w) => setWidths((was) => ({ ...was, right: w }))}
              sidebar={right}
            >
              {middle}
            </Split>
          </Split>
        )}
      </div>
    </div>
  );
}

export function App() {
  return (
    <LabShell
      title="bree compose"
      mode="dark"
      pages={PAGES}
      header={
        <>
          <UndoBar />
          <ShareBar />
        </>
      }
    >
      <Persistence storageKey={SIGN_RECORDS} storage={localStorageAdapter}>
        <Compose />
      </Persistence>
    </LabShell>
  );
}
