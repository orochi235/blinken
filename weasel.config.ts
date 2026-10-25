import { existsSync, readdirSync, readFileSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * The lab serves `@weasel-js/*` from the built `dist` of a weasel checkout beside bree where there
 * is one, and from the published packages where there is not, or with WEASEL=npm. Each import
 * resolves from the checkout's root, so its workspace links answer it and every package's
 * `exports` and subpaths still apply.
 */
const beside = fileURLToPath(new URL('../weasel', import.meta.url));
export const WEASEL =
  process.env.WEASEL !== 'npm' && existsSync(join(beside, 'packages/labkit/dist'))
    ? beside
    : undefined;

/** When `dist` was last built, from its top-level entries, which every build rewrites. */
const builtAt = (dist: string): number =>
  existsSync(dist)
    ? readdirSync(dist).reduce((m, f) => Math.max(m, statSync(join(dist, f)).mtimeMs), 0)
    : 0;

/** Whether any file under `src` was written after `ms`. */
const editedSince = (src: string, ms: number): boolean =>
  existsSync(src) &&
  readdirSync(src, { recursive: true, encoding: 'utf8' }).some(
    (f) => statSync(join(src, f)).mtimeMs > ms,
  );

/** The `@weasel-js` packages bree depends on whose checkout `dist` is older than their `src`. */
function staleBuilds(root: string): string[] {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter((name) => name.startsWith('@weasel-js/'))
    .filter((name) => {
      const dir = join(root, 'packages', name.slice('@weasel-js/'.length));
      return editedSince(join(dir, 'src'), builtAt(join(dir, 'dist')));
    });
}

if (WEASEL) {
  const stale = staleBuilds(WEASEL);
  if (stale.length)
    console.warn(
      `bree: serving ${stale.join(', ')} from ${WEASEL}, whose dist is older than its src. Rebuild weasel, or set WEASEL=npm.`,
    );
}

/** A file a package's build wrote, by its path under `packages/`. */
const IN_DIST = /^[^/]+\/dist\//;
/** How long a checkout's `dist` files stay unwritten before its build is taken as done. */
const BUILD_QUIET_MS = 1500;

export function weaselCheckout(): Plugin {
  return {
    name: 'bree-weasel-checkout',
    enforce: 'pre',
    config() {
      if (!WEASEL) return;
      // Prebundled, the checkout's build would be frozen at startup.
      const exclude = readdirSync(join(WEASEL, 'packages')).map((dir) => `@weasel-js/${dir}`);
      return { optimizeDeps: { exclude }, server: { fs: { allow: [WEASEL] } } };
    },
    configureServer(server) {
      if (!WEASEL) return;
      // A rebuild deletes and rewrites each file vite served, so it watches from above `dist`.
      let settled: ReturnType<typeof setTimeout> | null = null;
      const rebuilt = watch(join(WEASEL, 'packages'), { recursive: true }, (_event, name) => {
        if (!name || !IN_DIST.test(name)) return;
        if (settled) clearTimeout(settled);
        settled = setTimeout(() => {
          server.moduleGraph.invalidateAll();
          server.hot.send({ type: 'full-reload' });
        }, BUILD_QUIET_MS);
      });
      server.httpServer?.once('close', () => rebuilt.close());
    },
    resolveId(source) {
      if (!WEASEL || !source.startsWith('@weasel-js/')) return null;
      return this.resolve(source, join(WEASEL, 'package.json'), { skipSelf: true });
    },
  };
}
