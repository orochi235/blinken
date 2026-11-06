// Pins every `@msb235/blinken@x.y.z` in the docs to the package's version. Run directly, it rewrites
// README.md; npm runs it on `npm version`, and the docs site pins its pages the same way at build.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A versioned reference to the package, as a CDN URL or an install names it. */
export const PINNED = /@msb235\/blinken@\d+\.\d+\.\d+(?:-[\w.]+)?/g;

/** `text` with every pinned reference at `version`. */
export function pin(text, version) {
  return text.replace(PINNED, `@msb235/blinken@${version}`);
}

export const VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const readme = new URL('../README.md', import.meta.url);
  writeFileSync(readme, pin(readFileSync(readme, 'utf8'), VERSION));
}
