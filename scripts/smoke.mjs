// Loads the built marquee in headless Chromium at a desktop and a phone width, and stretched to
// 320 × 63, printing what a frame costs in each, then the compose lab at both widths. Fails on any
// console or page error, a sign that lit nothing, or a page wider than its viewport.
// `--shots <dir>` keeps a screenshot per width, which otherwise go to a temp directory removed on
// exit.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { litPixels } from './lit.mjs';
import { serve } from './serve.mjs';

const { origin, close } = await serve();

const shotsAt = process.argv.indexOf('--shots');
const kept = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
if (kept) mkdirSync(kept, { recursive: true });
const shots = kept ?? mkdtempSync(join(tmpdir(), 'marquee-smoke-'));

const widths = [
  { name: 'desktop', width: 1280, height: 800, query: 'play' },
  { name: 'phone', width: 390, height: 844, query: 'play' },
  { name: 'stretched', width: 1280, height: 800, query: 'play?cols=320&rows=63' },
  { name: 'compose', width: 1280, height: 800, query: 'compose' },
  { name: 'compose-phone', width: 390, height: 844, query: 'compose' },
];
const browser = await chromium.launch({ headless: true });
let failed = 0;
try {
  for (const [i, w] of widths.entries()) {
    const page = await browser.newPage({ viewport: { width: w.width, height: w.height } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + w.query, { waitUntil: 'networkidle' });
    // Into the first held message, past its wipe on, then the brightest of a few frames, since
    // a flash or sparkle can catch any one frame dim.
    await page.waitForTimeout(2200);
    let lit = 0;
    for (let s = 0; s < 5; s++) {
      if (s) await page.waitForTimeout(150);
      const n = await litPixels(page, page.locator('#sign'));
      lit = Math.max(lit, n);
    }
    const cost = await page.evaluate(() => document.getElementById('cost')?.value ?? '');
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.screenshot({ path: join(shots, `${w.name}.png`) });
    const problems = [...errors];
    if (lit < 200) problems.push(`the sign lit only ${lit} pixels`);
    if (wide) problems.push('the page is wider than its viewport');
    console.log(
      `${i + 1}/${widths.length}  ${problems.length ? 'FAIL' : 'ok  '}  ${w.name}  ${lit} lit pixels  ${cost}`,
    );
    for (const p of problems) console.log(`      ${p}`);
    if (problems.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
  close();
  if (!kept) rmSync(shots, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
