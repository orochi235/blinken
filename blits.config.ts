import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * blinken runs on a blits checkout beside it where there is one, and on the published package where
 * there is not, or with BLITS=npm.
 */
export const blitsAlias: Record<string, string> =
  process.env.BLITS !== 'npm' && existsSync(at('../blits/src/index.ts'))
    ? {
        '@msb235/blits/gpu': at('../blits/src/gpu.ts'),
        '@msb235/blits-panel': at('../blits/packages/panel/src/index.ts'),
        '@msb235/blits': at('../blits/src/index.ts'),
      }
    : {};

export const src = at('./src');
