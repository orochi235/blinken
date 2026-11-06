// esbuild with blinken's own module paths: `@/` to src/, and blits to a checkout beside it if there is one.
import { build } from 'esbuild';
import { blitsAlias } from '../blits.config.ts';

const src = new URL('../src/', import.meta.url).pathname;

/** Bundles with esbuild, `@/` and blits resolved as the lab and tests resolve them; nothing written. */
export const bundle = (options) =>
  build({
    bundle: true,
    write: false,
    alias: blitsAlias,
    // esbuild resolves through tsconfig.json's `paths`, which list ../blits first, alias or not.
    ...(Object.keys(blitsAlias).length ? {} : { tsconfigRaw: { compilerOptions: { paths: {} } } }),
    logLevel: 'error',
    ...options,
    plugins: [
      {
        name: 'blinken-src',
        setup(b) {
          b.onResolve({ filter: /^@\// }, (a) =>
            b.resolve(`./${a.path.slice(2)}`, { resolveDir: src, kind: a.kind }),
          );
        },
      },
      ...(options.plugins ?? []),
    ],
  });

/** A TypeScript module's exports, bundled for node and imported, for a script using lab code. */
export async function load(entry) {
  const out = await bundle({ entryPoints: [entry], format: 'esm', platform: 'node' });
  const js = Buffer.from(out.outputFiles[0].text).toString('base64');
  return import(`data:text/javascript;base64,${js}`);
}
