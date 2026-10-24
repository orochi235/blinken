import { ControlPanel, withValueAtPath } from '@weasel-js/labkit';
import { type Hardware, hardwareSchema, shownHardware, storedHardware } from '../hardware.js';
import { DENSITY } from '../schema.js';

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
    <section className="compose-hardware" aria-label="sign">
      <h2 className="compose-heading">sign</h2>
      <ControlPanel
        schema={hardwareSchema()}
        config={shownHardware(hardware)}
        setConfig={set}
        draftConfig={set}
        density={DENSITY}
      />
    </section>
  );
}
