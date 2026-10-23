import { ControlPanel, withValueAtPath } from '@weasel-js/labkit';
import { type Hardware, hardwareSchema } from '../hardware.js';

/** The sign's hardware: how its lights fade, how much they ghost, and which are broken. */
export function HardwarePanel({
  hardware,
  setHardware,
}: {
  hardware: Hardware;
  setHardware: (next: (h: Hardware) => Hardware) => void;
}) {
  const set = (path: string, value: unknown) =>
    setHardware((h) => withValueAtPath(h, path, value) as Hardware);
  return (
    <ControlPanel
      title="sign"
      collapsible
      schema={hardwareSchema()}
      config={hardware}
      setConfig={set}
      draftConfig={set}
      density="tight"
    />
  );
}
