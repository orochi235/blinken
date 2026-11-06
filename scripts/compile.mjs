// Builds the <bree-player> element into one self-contained script: everything inlined, nothing
// fetched. Given a program (a share link, the part after its `#`, or a composition .json file), it
// is compiled in as what the element plays when the page gives it none.
//
//   npm run compile                                   the plain player, dist-player/bree-player.js
//   npm run compile -- '<link>' --out sign.js --tag shop-sign --cols 40 --grid triangles
//   npm run compile -- show.json --hardware '{"fade":{"fall":400}}'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { bundle, load } from './bundle.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'dist-player/bree-player.js' },
    tag: { type: 'string', default: 'bree-player' },
    hardware: { type: 'string' },
    cols: { type: 'string' },
    rows: { type: 'string' },
    grid: { type: 'string' },
    bulbs: { type: 'string' },
  },
});

const root = new URL('..', import.meta.url).pathname;

function fail(why) {
  console.error(`compile: ${why}`);
  process.exit(1);
}

if (!/^[a-z][a-z0-9._]*-[a-z0-9._-]*$/.test(values.tag))
  fail(
    `"${values.tag}" can't name an element: it needs a hyphen, lowercase, starting with a letter.`,
  );

const input = positionals[0];
const program = input && existsSync(input) ? readFileSync(input, 'utf8') : input;
let hardware;
try {
  hardware = values.hardware ? JSON.parse(values.hardware) : undefined;
} catch {
  fail('--hardware is not JSON.');
}
const num = (v) => (v === undefined ? undefined : Number(v));
const baked = {
  program: program ?? null,
  hardware: [
    hardware,
    {
      size: { cols: num(values.cols), rows: num(values.rows), grid: values.grid },
      border: { bulbs: values.bulbs },
    },
  ],
};

// Read it here as the element will, so a link that doesn't read fails now rather than on the page.
const { resolve } = await load(`${root}player/config.ts`);
const { decoded, hardware: resolved } = resolve([baked]);
if (program && !decoded?.read) fail(`couldn't read a program from ${JSON.stringify(input)}.`);
if (decoded?.dropped.length) console.warn(`left out: ${decoded.dropped.join('; ')}`);

const out = await bundle({
  entryPoints: [`${root}player/index.ts`],
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  // The package says it has no side effects, which would drop the element's definition.
  ignoreAnnotations: true,
  define: {
    __BREE_TAG__: JSON.stringify(values.tag),
    __BREE_BAKED__: JSON.stringify(baked),
    'process.env.NODE_ENV': '"production"',
  },
});
const js = out.outputFiles[0].contents;
mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(values.out, js);
const kb = (n) => `${(n / 1024).toFixed(0).padStart(4)} KB`;
const { cols, rows, grid } = resolved.size;
console.log(`${values.out}  <${values.tag}>`);
console.log(`  ${kb(js.length)} minified, ${kb(gzipSync(js).length)} gzipped`);
console.log(
  decoded
    ? `  plays ${decoded.state.program.length} scene(s) on ${cols}×${rows} ${grid} unless the page says otherwise`
    : '  plays only what the page gives it',
);
