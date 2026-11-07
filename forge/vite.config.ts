import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { blitsAlias, src } from '../blits.config.ts';
import { WEASEL, weaselCheckout } from '../weasel.config.ts';

// The plugin and the workshop it serves come from the same weasel: the checkout's where the lab uses it.
const { forge } = (
  WEASEL
    ? await import(join(WEASEL, 'packages/forge/dist/vite/index.js'))
    : await import('@weasel-js/forge/vite')
) as typeof import('@weasel-js/forge/vite');

const root = fileURLToPath(new URL('..', import.meta.url));

/** blinken's workshop: each piece on its own, with controls, from the stories under `forge/stories`. */
export default defineConfig({
  root,
  cacheDir: join(root, 'node_modules/.vite-forge'),
  plugins: [
    weaselCheckout(),
    react(),
    forge({
      stories: ['forge/stories/**/*.stories.tsx'],
      shellConfig: 'forge/forge.shell.tsx',
      frameConfig: 'forge/forge.frame.tsx',
    }),
  ],
  resolve: { alias: { ...blitsAlias, '@': src }, dedupe: ['react', 'react-dom'] },
  server: {
    host: '::',
    port: 4887,
    strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(root), '../blits'] },
  },
  build: { outDir: join(root, 'dist-forge'), emptyOutDir: true },
});
