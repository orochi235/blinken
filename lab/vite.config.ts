import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { blitsAlias, src } from '../blits.config.ts';

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  // The blits checkout's panel would otherwise bring a second React.
  resolve: { alias: { ...blitsAlias, '@': src }, dedupe: ['react', 'react-dom'] },
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
