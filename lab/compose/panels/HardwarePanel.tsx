import { ControlPanel, withValueAtPath } from '@weasel-js/labkit';
import { type Hardware, hardwareSchema, shownHardware, storedHardware } from '../hardware.js';
import { Panel } from '../Panel.js';
import { DENSITY } from '../schema.js';
import './HardwarePanel.css';

/** The sign's hardware: how its lights fade, how much they ghost, and which are broken. */
export function HardwarePanel({
  hardware,
  setHardware,
}: {
  hardware: Hardware;
  setHardware: (next: (h: Hardware) => Hardware) => void;
}) {
  const set = (path: string, value: unknown) =>
    setHardware((h) => withValueAtPath(h, path, storedHardware(path, value)) as Hardware);
  return (
    <Panel title="sign" className="compose-hardware">
      <ControlPanel
        schema={hardwareSchema()}
        config={shownHardware(hardware)}
        setConfig={set}
        draftConfig={set}
        density={DENSITY}
      />
    </Panel>
  );
}
