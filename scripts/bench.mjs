// Sweeps backends × light counts in headless Chromium on the real GPU, once through every pair
// before any repeat, printing a line per run and keeping each run's raw record in bench/runs/.
//   node scripts/bench.mjs [--backends 2d,webgl,webgpu] [--lights 1000,4000,20000,80000]
//     [--seconds 5] [--repeat 1] [--label <round>] [--no-build] [--read]
//   node scripts/bench.mjs --page digits [--ways separate,shared] [--digits 500] ...
// The digits page draws many digit-sized signs on WebGPU, each on its own canvas or all on one.
// Frames are uncapped (no vsync), so fps measures throughput rather than the display.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { digest, RECORD } from './bench-digest.mjs';
import { serve } from './serve.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const runs = join(root, 'bench/runs');
const KEEP = 200;
const RUN_LIMIT_MS = 120_000;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const list = (name, fallback) => arg(name, fallback).split(',').filter(Boolean);
const backends = list('backends', '2d,webgl,webgpu');
const counts = list('lights', '1000,4000,20000,80000').map(Number);
const seconds = Number(arg('seconds', '5'));
const repeat = Number(arg('repeat', '1'));
const label = arg('label', null);
// The bench page reads its sign's columns every frame, as a host watching them would.
const reads = process.argv.includes('--read');
const pageName = arg('page', 'bench');
const stack = arg('stack', pageName === 'digits' ? 'sparkle,rainbow' : 'sparkle,rainbow,chase');
const ways = list('ways', 'separate,shared');
const digitCounts = list('digits', '500').map(Number);

mkdirSync(runs, { recursive: true });
const old = readdirSync(runs)
  .filter((f) => RECORD.test(f))
  .sort()
  .reverse();
// Room is left for this sweep's records, so the directory ends it at the newest 200 or fewer.
const runCount =
  (pageName === 'digits' ? ways.length * digitCounts.length : backends.length * counts.length) *
  repeat;
for (const f of old.slice(Math.max(0, KEEP - runCount))) rmSync(join(runs, f));

if (!process.argv.includes('--no-build'))
  execFileSync('npx', ['vite', 'build', 'lab', '--logLevel', 'error'], {
    cwd: root,
    stdio: 'inherit',
  });

const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
const commit = git('rev-parse', '--short', 'HEAD');
const dirty = Boolean(git('status', '--porcelain', '--untracked-files=no'));
/**
 * The blits checkout beside this one that the lab builds against, if any. A fleet node's files are
 * synced over its checkout, so there the commit can name older code than was built.
 */
const besideBlits = join(root, '../blits');
const blits = {
  commit: git('-C', besideBlits, 'rev-parse', '--short', 'HEAD'),
  dirty: Boolean(git('-C', besideBlits, 'status', '--porcelain', '--untracked-files=no')),
};
const machine = {
  host: hostname(),
  platform: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model,
  cores: cpus().length,
  memGiB: Math.round(totalmem() / 2 ** 30),
};
const flags = ['--enable-unsafe-webgpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'];

const { origin, close } = await serve();
const browser = await chromium.launch({ headless: true, channel: 'chromium', args: flags });
const chrome = browser.version();

/** One run: the page's report, or an error. */
async function once(asked) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    const got = new Promise((resolve) => {
      page.on('console', (m) => {
        const t = m.text();
        if (t.startsWith('__bench__ ')) resolve(JSON.parse(t.slice(10)));
        else if (m.type() === 'error') console.log(`  [page error] ${t}`);
      });
      page.on('pageerror', (e) => resolve({ error: e.message }));
    });
    const q = new URLSearchParams({ ...asked, seconds, stack, ...(reads && { read: '1' }) });
    await page.goto(`${origin}${pageName}?${q}`);
    const timeout = new Promise((r) =>
      setTimeout(() => r({ error: `no report in ${RUN_LIMIT_MS / 1000} s` }), RUN_LIMIT_MS),
    );
    return await Promise.race([got, timeout]);
  } finally {
    await page.close();
  }
}

const plan = [];
for (let k = 0; k < repeat; k++)
  if (pageName === 'digits')
    for (const digits of digitCounts) for (const way of ways) plan.push({ way, digits });
  else for (const lights of counts) for (const backend of backends) plan.push({ backend, lights });
const n = (x, w, d) => x.toFixed(d).padStart(w);
let failed = 0;
for (const [i, asked] of plan.entries()) {
  const load = loadavg();
  const r = await once(asked);
  const at = new Date().toISOString();
  const [what, size] = asked.way ? [asked.way, asked.digits] : [asked.backend, asked.lights];
  const head = `${String(i + 1).padStart(String(plan.length).length)}/${plan.length} ${what.padEnd(8)} ${String(size).padStart(6)}:`;
  if (r.error) {
    failed++;
    console.log(`${head} ${r.error}`);
  } else {
    const d = digest(r);
    const drew = [r.got].flat();
    const want = asked.backend ?? 'webgpu';
    const wrong = drew.every((g) => g === want) ? '' : `  (drew with ${drew.join(', ')})`;
    const cpu = r.reasons?.length ? `  (${r.reasons.length} voice(s) on the CPU)` : '';
    console.log(
      `${head} ${n(d.fps, 7, 1)} fps  p50/p95 ${n(d.p50, 7, 2)}/${n(d.p95, 7, 2)} ms  mix ${n(d.mixMs, 7, 2)} ms  draw ${n(d.drawMs, 7, 2)} ms${wrong}${cpu}`,
    );
  }
  const record = {
    at,
    label,
    commit,
    blits,
    dirty,
    machine,
    chrome,
    flags,
    load: { before: load, after: loadavg() },
    asked: { ...asked, page: pageName, seconds, stack, reads },
    ...r,
  };
  writeFileSync(
    join(runs, `${at.replace(/:/g, '-')}-${what}-${size}.json`),
    JSON.stringify(record),
  );
}
await browser.close();
close();
console.log(`${plan.length - failed}/${plan.length} runs kept in ${runs}`);
process.exit(failed ? 1 : 0);
