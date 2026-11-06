import { fileURLToPath } from 'node:url';
import { satteri } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { blitsAlias } from '../blits.config.ts';
import { linkExports } from './src/api/prose.ts';

const base = process.env.BLINKEN_SITE_BASE ?? '/';
const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  site: process.env.BLINKEN_SITE_URL ?? 'https://michaelbaker.tech',
  base,
  trailingSlash: 'always',
  integrations: [react(), mdx(), sitemap()],
  outDir: process.env.BLINKEN_SITE_OUT ?? './dist',
  markdown: {
    processor: satteri({ mdastPlugins: [linkExports(base.replace(/\/?$/, '/'))] }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: 'light' },
  },
  server: { host: '::', port: 4886 },
  vite: {
    resolve: {
      alias: { ...blitsAlias, '@msb235/blinken': at('../src/index.ts') },
      dedupe: ['react', 'react-dom'],
    },
    server: { fs: { allow: [at('..'), at('../../blits')] } },
  },
});
