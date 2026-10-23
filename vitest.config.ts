import { defineConfig } from 'vitest/config';
import { blitsAlias, src } from './blits.config.ts';

export default defineConfig({
  resolve: { alias: { ...blitsAlias, '@': src } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
