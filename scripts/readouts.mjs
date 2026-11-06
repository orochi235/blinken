// Loads the built readouts lab page in headless Chromium on each backend, and writes a screenshot
// per backend to `--out <dir>` (default: a temp directory removed on exit). Fails on a console or
// page error, a backend other than the one asked for, or a root that scrolls.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

const at = process.argv.indexOf('--out');
const kept = at > 0 ? process.argv[at + 1] : null;
if (kept) mkdirSync(kept, { recursive: true });
const out = kept ?? mkdtempSync(join(tmpdir(), 'blinken-readouts-'));
const backends = ['webgpu', 'webgl', '2d'];

const { origin, close } = await serve();
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-unsafe-webgpu'],
});
let failed = 0;
try {
  for (const [i, backend] of backends.entries()) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}readouts.html?backend=${backend}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const got = await page.textContent('#got');
    const scrolled = await page.evaluate(() => {
      scrollTo(0, 5000);
      return scrollY;
    });
    const shot = join(out, `readouts-${backend}.png`);
    await page.screenshot({ path: shot });
    const bad = [
      ...errors,
      ...(got?.startsWith(backend) ? [] : [`drew with ${got}`]),
      ...(scrolled === 0 ? [] : [`the root scrolled to ${scrolled}`]),
    ];
    console.log(
      `${i + 1}/${backends.length} ${bad.length ? '✗' : '✓'} ${backend}: ${got} → ${shot}`,
    );
    for (const b of bad) console.log(`    ${b}`);
    if (bad.length) failed++;
    await page.close();
  }
} finally {
  await browser.close();
  close();
  if (!kept) rmSync(out, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
