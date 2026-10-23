import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { blitsAlias, src } from '../blits.config.ts';

export default defineConfig({
  base: './',
  resolve: { alias: { ...blitsAlias, '@': src } },
  build: { outDir: '../dist-lab', emptyOutDir: true },
  server: {
    host: '::',
    port: 4885,
    strictPort: true,
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../../blits'] },
  },
});
