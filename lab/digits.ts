// One run of the many-displays benchmark on WebGPU: `?digits=` digit-sized signs drawn `?way=`
// separate (a canvas and a sign each, on one ticker and one device) or shared (one sign on one
// canvas holding every digit's dots), for `?seconds=` after a warmup. Prints `__bench__ {json}`
// once; scripts/bench.mjs drives it with `--page digits`.
import './bench.css';
import { createMarquee, createTicker, gpu, type Marquee } from '@/index.js';
import { reasonsOf } from './reasons.js';

const params = new URLSearchParams(location.search);
const way = params.get('way') ?? 'separate';
const digits = Number(params.get('digits') ?? 500);
const seconds = Number(params.get('seconds') ?? 5);
const stack = (params.get('stack') ?? 'sparkle,rainbow').split(',').filter(Boolean);
const WARMUP_MS = 1000;
const FEWEST = 3;
/** A digit is a 5 × 7 character; the shared sign leaves a dot between digits and a row between lines. */
const COLS = 5;
const ROWS = 7;

const report = (body: Record<string, unknown>) => console.log(`__bench__ ${JSON.stringify(body)}`);

async function run() {
  const handle = await gpu();
  if (!handle) return report({ error: 'no WebGPU device' });
  const across = Math.ceil(Math.sqrt(digits * 1.6));
  const down = Math.ceil(digits / across);
  const page = document.getElementById('page') as HTMLElement;
  page.style.setProperty('--across', String(across));
  const layers = Object.fromEntries(stack.map((s) => [s, true]));
  const ticker = createTicker();

  // Each frame is the sum over every sign the ticker called, and the gap is marked by the first.
  const frames: { t: number; mixMs: number; drawMs: number }[] = [];
  let start = Number.NaN;
  let measured = 0;
  let finish: () => void = () => {};
  const done = new Promise<void>((r) => {
    finish = r;
  });
  const onFrame = (first: boolean) => (cost: { raw: { mixMs: number; drawMs: number } }) => {
    const now = performance.now();
    if (first) {
      if (Number.isNaN(start)) start = now;
      frames.push({ t: now - start, mixMs: 0, drawMs: 0 });
      const t = now - start - WARMUP_MS;
      if (t >= 0) measured++;
      if ((t >= seconds * 1000 && measured >= FEWEST) || t >= seconds * 4000) finish();
    }
    const f = frames.at(-1);
    if (!f) return;
    f.mixMs += cost.raw.mixMs;
    f.drawMs += cost.raw.drawMs;
  };

  const signs: Marquee[] = [];
  const canvases: HTMLCanvasElement[] = [];
  if (way === 'separate') {
    page.className = 'digits-grid';
    for (let i = 0; i < digits; i++) {
      const cell = document.createElement('div');
      const canvas = document.createElement('canvas');
      cell.append(canvas);
      page.append(cell);
      canvases.push(canvas);
      signs.push(
        createMarquee(canvas, {
          gpu: handle,
          backend: 'webgpu',
          cols: COLS,
          rows: ROWS,
          border: false,
          layers,
          ticker,
          program: [{ effect: 'hold', text: String(i % 10), hex: 0xff9a2e }],
          onFrame: onFrame(i === 0),
        }),
      );
    }
  } else {
    page.className = 'digits-one';
    const canvas = document.createElement('canvas');
    page.append(canvas);
    canvases.push(canvas);
    const text = Array.from({ length: across }, (_, i) => String(i % 10)).join('');
    signs.push(
      createMarquee(canvas, {
        gpu: handle,
        backend: 'webgpu',
        cols: across * (COLS + 1) - 1,
        rows: down * (ROWS + 1) - 1,
        border: false,
        layers,
        ticker,
        program: [{ effect: 'hold', text, hex: 0xff9a2e }],
        onFrame: onFrame(true),
      }),
    );
  }
  await done;
  const lights = signs.reduce((n, s) => n + s.board.dots.length, 0);
  const got = [...new Set(signs.map((s) => s.backend))];
  const canvas = canvases[0];
  const px = canvases.reduce((n, c) => n + c.width * c.height, 0);
  // Every sign's own, since each separate sign folds on its own side.
  const reasons = signs.flatMap((s) => reasonsOf(s) ?? []);
  for (const s of signs) s.destroy();
  report({
    way,
    digits,
    got,
    lights,
    signs: signs.length,
    stack,
    seconds,
    warmupMs: WARMUP_MS,
    canvas: { width: canvas?.width, height: canvas?.height, pixels: px, dpr: devicePixelRatio },
    reasons,
    frames,
  });
}

run().catch((e) => report({ error: String(e?.stack ?? e) }));
