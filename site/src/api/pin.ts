import { defineMdastPlugin } from 'satteri';
import { pin, VERSION } from '../../../scripts/pin-version.mjs';

/** Pins the pages' `@msb235/blinken@x.y.z` references, in code and prose, to the package's version. */
export function pinVersion() {
  const at = (
    node: { value: string },
    ctx: { setProperty: (n: never, k: 'value', v: string) => void },
  ) => {
    const value = pin(node.value, VERSION);
    if (value !== node.value) ctx.setProperty(node as never, 'value', value);
  };
  return defineMdastPlugin({ name: 'pin-version', code: at, inlineCode: at, text: at, html: at });
}
