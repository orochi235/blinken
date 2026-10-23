import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { blitsAlias, src } from '../blits.config.ts';

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  base: './',
  resolve: { alias: { ...blitsAlias, '@': src } },
  build: {
    outDir: '../dist-lab',
    emptyOutDir: true,
    rollupOptions: { input: { main: page('index.html'), compose: page('compose.html') } },
  },
  server: {
    host: '::',
    port: 4885,
    strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../../blits'] },
  },
});
