// Sweeps backends × light counts in headless Chromium on the real GPU, once through every pair
// before any repeat, printing a line per run and keeping each run's raw record in bench/runs/.
//   node scripts/bench.mjs [--backends 2d,webgl,webgpu] [--lights 1000,4000,20000,80000]
//     [--seconds 5] [--repeat 1] [--label <round>] [--no-build]
// Frames are uncapped (no vsync), so fps measures throughput rather than the display.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
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
const stack = arg('stack', 'sparkle,rainbow,chase');

mkdirSync(runs, { recursive: true });
const old = readdirSync(runs)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .reverse();
// Room is left for this sweep's records, so the directory ends it at the newest 200 or fewer.
for (const f of old.slice(Math.max(0, KEEP - backends.length * counts.length * repeat)))
  rmSync(join(runs, f));

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
/** The blits checkout beside this one that the lab builds against, if any. */
const blits = git('-C', join(root, '../blits'), 'rev-parse', '--short', 'HEAD');
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
async function once(backend, lights) {
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
    const q = new URLSearchParams({ backend, lights, seconds, stack });
    await page.goto(`${origin}bench?${q}`);
    const timeout = new Promise((r) =>
      setTimeout(() => r({ error: `no report in ${RUN_LIMIT_MS / 1000} s` }), RUN_LIMIT_MS),
    );
    return await Promise.race([got, timeout]);
  } finally {
    await page.close();
  }
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : Number.NaN;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The run's headline numbers, from its frames past the warmup. */
function digest(r) {
  const kept = r.frames.filter((f) => f.t >= r.warmupMs);
  const gaps = kept.slice(1).map((f, i) => f.t - (kept[i]?.t ?? 0));
  const span = kept.length > 1 ? (kept.at(-1).t - kept[0].t) / 1000 : Number.NaN;
  return {
    frames: kept.length,
    fps: (kept.length - 1) / span,
    p50: pct(gaps, 0.5),
    p95: pct(gaps, 0.95),
    mixMs: mean(kept.map((f) => f.mixMs)),
    drawMs: mean(kept.map((f) => f.drawMs)),
  };
}

const plan = [];
for (let k = 0; k < repeat; k++)
  for (const lights of counts) for (const backend of backends) plan.push({ backend, lights });
const n = (x, w, d) => x.toFixed(d).padStart(w);
let failed = 0;
for (const [i, { backend, lights }] of plan.entries()) {
  const load = loadavg();
  const r = await once(backend, lights);
  const at = new Date().toISOString();
  const head = `${String(i + 1).padStart(String(plan.length).length)}/${plan.length} ${backend.padEnd(6)} ${String(lights).padStart(6)}:`;
  if (r.error) {
    failed++;
    console.log(`${head} ${r.error}`);
  } else {
    const d = digest(r);
    const wrong = r.got === backend ? '' : `  (drew with ${r.got})`;
    console.log(
      `${head} ${n(d.fps, 7, 1)} fps  p50/p95 ${n(d.p50, 7, 2)}/${n(d.p95, 7, 2)} ms  mix ${n(d.mixMs, 7, 2)} ms  draw ${n(d.drawMs, 7, 2)} ms${wrong}`,
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
    asked: { backend, lights, seconds, stack },
    ...r,
  };
  writeFileSync(
    join(runs, `${at.replace(/:/g, '-')}-${backend}-${lights}.json`),
    JSON.stringify(record),
  );
}
await browser.close();
close();
console.log(`${plan.length - failed}/${plan.length} runs kept in ${runs}`);
process.exit(failed ? 1 : 0);
