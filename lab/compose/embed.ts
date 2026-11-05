import { encode, playable } from './share.js';
import { HARDWARE, type Hardware } from './sign-hardware.js';
import type { ComposeState } from './state.js';

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * HTML that plays `state` on a page through the `<bree-player>` script (`npm run compile`): the
 * size and grid as attributes, and only the hardware that differs from the defaults.
 */
export function embedOf(state: ComposeState, hardware: Hardware): string {
  const { cols, rows, grid } = hardware.size;
  const rest: Record<string, Record<string, unknown>> = {};
  for (const [g, group] of Object.entries(hardware) as [
    keyof Hardware,
    Record<string, unknown>,
  ][]) {
    if (g === 'size') continue;
    const base = HARDWARE[g] as Record<string, unknown>;
    for (const [k, v] of Object.entries(group)) if (v !== base[k]) rest[g] = { ...rest[g], [k]: v };
  }
  const extra = Object.keys(rest).length ? ` hardware="${attr(JSON.stringify(rest))}"` : '';
  return [
    '<script src="bree-player.js"></script>',
    `<bree-player program="${encode(playable(state))}" cols="${cols}" rows="${rows}" grid="${grid}"${extra}></bree-player>`,
  ].join('\n');
}
