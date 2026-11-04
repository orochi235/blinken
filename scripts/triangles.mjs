// Screenshots the built play page on the triangle grid, A (bree's faces, two places to a dot) and
// B (the strokes face), on WebGPU, into `--out <dir>`. Fails on a console or page error.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const at = process.argv.indexOf('--out');
const out = at > 0 ? process.argv[at + 1] : 'shots';
mkdirSync(out, { recursive: true });
const pages = [
  { name: 'triangles', query: 'play?grid=triangles&show=hold&nopanel' },
  {
    name: 'triangles-strokes',
    query: 'play?grid=triangles&face=strokes&rows=16&cols=120&show=hold&nopanel',
  },
];
const { origin, close } = await serve();
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-unsafe-webgpu'],
});
let failed = 0;
try {
  for (const [i, p] of pages.entries()) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + p.query, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const shot = join(out, `${p.name}.png`);
    await page.screenshot({ path: shot });
    console.log(`${i + 1}/${pages.length} ${errors.length ? '✗' : '✓'} ${p.name} → ${shot}`);
    for (const e of errors) console.log(`    ${e}`);
    if (errors.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
  close();
}
process.exit(failed ? 1 : 0);
