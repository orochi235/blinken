// Times one reel cell's draw in headless Chromium at each speed, in glyphs a frame, printing a line
// per speed and keeping the run's raw timings in bench/runs/reel-blur/ (the newest 50 kept).
// With --against <module>, also checks that module's drawReel draws a reel at rest and turning
// slowly to the same pixels as this one's, as main's copy of draw.ts should, and times it alongside.
//   node scripts/reel-blur.mjs --origin http://localhost:4887/ [--against /src/mechanical/old.ts]
//     [--travels 0,0.5,1,1.5,2,3,5] [--frames 400] [--rounds 5]
// The origin is any vite dev server serving this repository's src/, such as `npm run forge`.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const runs = join(root, 'bench/runs/reel-blur');
const KEEP = 50;
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const origin = arg('origin', 'http://localhost:4887/');
const against = arg('against', null);
const travels = arg('travels', '0,0.5,1,1.5,2,3,5').split(',').map(Number);
const frames = Number(arg('frames', '400'));
const rounds = Number(arg('rounds', '5'));

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const page = await browser.newPage();
await page.goto(origin);
const job = { travels, frames, rounds, against };
const result = await page.evaluate(async ({ travels, frames, rounds, against }) => {
  const { drawReel } = await import('/src/mechanical/draw.ts');
  const { LOOKS } = await import('/src/mechanical/style.ts');
  const glyphs = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
  const box = { x: 4, y: 4, w: 72, h: 112 };
  // Not `willReadFrequently`: that keeps the canvas on the CPU, as a readout's canvas isn't.
  const canvas = (draw) => {
    const c = document.createElement('canvas');
    c.width = 80;
    c.height = 120;
    const ctx = c.getContext('2d');
    draw(ctx);
    return ctx;
  };
  const identity = [];
  const old = against ? await import(against) : null;
  if (old) {
    for (const [pos, travel] of [
      [0, 0],
      [3.4, 0],
      [7.75, 0.6],
      [12.2, 1],
    ]) {
      const a = canvas((ctx) => drawReel(ctx, glyphs, pos, box, LOOKS.reel, 1, travel));
      const b = canvas((ctx) => old.drawReel(ctx, glyphs, pos, box, LOOKS.reel, 1));
      const pa = a.getImageData(0, 0, 80, 120).data;
      const pb = b.getImageData(0, 0, 80, 120).data;
      let differ = 0;
      for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) differ++;
      identity.push({ pos, travel, differingBytes: differ });
    }
  }
  const ctx = canvas(() => {});
  // A draw is queued, not done, until something reads the pixels back.
  const flush = () => ctx.getImageData(0, 0, 1, 1);
  const timings = [];
  const draws = [['this', drawReel], ...(old ? [['against', old.drawReel]] : [])];
  for (let r = 0; r < rounds; r++) {
    for (const travel of travels) {
      for (const [who, draw] of draws) {
        flush();
        const t0 = performance.now();
        for (let f = 0; f < frames; f++) draw(ctx, glyphs, f * 0.37, box, LOOKS.reel, 1, travel);
        flush();
        timings.push({ round: r, who, travel, ms: performance.now() - t0 });
      }
    }
  }
  return { identity, timings, ua: navigator.userAgent };
}, job);
await browser.close();

for (const i of result.identity)
  console.log(
    `same pixels at pos ${i.pos} travel ${i.travel}: ${i.differingBytes === 0 ? 'yes' : `no, ${i.differingBytes} bytes differ`}`,
  );
const whos = against ? ['this', 'against'] : ['this'];
for (const [k, travel] of travels.entries()) {
  for (const who of whos) {
    const per = result.timings
      .filter((t) => t.travel === travel && t.who === who)
      .map((t) => (t.ms * 1000) / frames);
    const median = [...per].sort((a, b) => a - b)[Math.floor(per.length / 2)];
    console.log(
      `${k + 1}/${travels.length} travel ${travel.toFixed(1).padStart(4)} ${who.padEnd(7)}: median ${median.toFixed(1).padStart(6)} µs a draw (${per.map((p) => p.toFixed(1).padStart(6)).join(', ')})`,
    );
  }
}

mkdirSync(runs, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const record = {
  at: new Date().toISOString(),
  machine: { host: hostname(), cpu: cpus()[0]?.model, cores: cpus().length, load: loadavg() },
  job,
  ...result,
};
writeFileSync(join(runs, `${stamp}.json`), `${JSON.stringify(record, null, 1)}\n`);
for (const f of readdirSync(runs).sort().reverse().slice(KEEP)) rmSync(join(runs, f));
console.log(`kept in bench/runs/reel-blur/${stamp}.json`);
