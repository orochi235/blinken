// Plays <blinken-player> on a bare page in headless Chromium, the way someone embedding it would: a
// program in a `program` attribute, one in a JSON child, and one compiled in under its own tag.
// Checks each lights pixels with no page errors, and that changing an attribute rebuilds the sign.
// `npm run player:check` compiles the plain player first.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { load } from './bundle.mjs';
import { litPixels } from './lit.mjs';

const root = new URL('..', import.meta.url).pathname;
const file = JSON.stringify({
  blinken: 'composition',
  format: 2,
  effects: {},
  program: [{ effect: 'hold', text: 'OPEN', hex: 0xffb000 }],
});

// The same composition as a share link, encoded by the lab's own codec.
const { encode, fromJson } = await load(`${root}lab/compose/share.ts`);
const link = encode(fromJson(file).state);

const baked = 'dist-player/check-sign.js';
execFileSync(
  'node',
  ['scripts/compile.mjs', link, '--out', baked, '--tag', 'check-sign', '--cols', '24'],
  { stdio: 'inherit' },
);

const page = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000;width:800px">
<script src="/blinken-player.js"></script><script src="/check-sign.js"></script>
<blinken-player id="attr" program="${link}" cols="20" grid="hex"></blinken-player>
<blinken-player id="child"><script type="application/json">${file}</script></blinken-player>
<check-sign id="baked"></check-sign>
</body>`;
const files = {
  '/': ['text/html', page],
  '/blinken-player.js': ['text/javascript', readFileSync('dist-player/blinken-player.js')],
  '/check-sign.js': ['text/javascript', readFileSync(baked)],
};
const server = createServer((req, res) => {
  const f = files[req.url];
  if (!f) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': f[0] }).end(f[1]);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed++;
};
try {
  const tab = await browser.newPage({ viewport: { width: 800, height: 900 } });
  const errors = [];
  tab.on('pageerror', (e) => errors.push(String(e)));
  tab.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await tab.goto(`http://127.0.0.1:${server.address().port}/`);
  await tab.waitForTimeout(1500);

  for (const id of ['attr', 'child', 'baked']) {
    const n = await litPixels(tab, tab.locator(`#${id}`));
    check(n > 50, `#${id} lights ${String(n).padStart(6)} pixels`);
  }

  const aspect = () =>
    tab.evaluate(() =>
      document
        .getElementById('baked')
        .shadowRoot.querySelector('.box')
        .style.getPropertyValue('--aspect'),
    );
  const before = await aspect();
  await tab.evaluate(() => document.getElementById('baked').setAttribute('cols', '60'));
  await tab.waitForTimeout(300);
  const after = await aspect();
  check(before !== after && after !== '', `changing cols rebuilds the sign (${before} → ${after})`);
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await tab.screenshot({ path: 'dist-player/check.png' });
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
