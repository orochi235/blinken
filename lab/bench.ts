// One benchmark run: a sign of about `?lights=` lights on `?backend=`, scrolling under a typical
// stack of layers for `?seconds=` after a warmup, printing `__bench__ {json}` once when done.
// scripts/bench.mjs drives it.
import './bench.css';
import { type Backend, createMarquee, gpu } from '@/index.js';

const params = new URLSearchParams(location.search);
const backend = (params.get('backend') ?? '2d') as Backend;
const lights = Number(params.get('lights') ?? 1000);
const seconds = Number(params.get('seconds') ?? 5);
const WARMUP_MS = 1000;
/** A run this slow still gets a few frames, up to four times its time. */
const FEWEST = 3;
/** `chase` is the border's bulbs; every other name is a built-in layer. */
const stack = (params.get('stack') ?? 'sparkle,rainbow,chase').split(',').filter(Boolean);

/** Seven rows, a line of text, up to 1,000 lights; past that, square. */
const shape = (n: number) => {
  if (n <= 1000) return { cols: Math.max(1, Math.round(n / 7)), rows: 7 };
  const side = Math.round(Math.sqrt(n));
  return { cols: side, rows: side };
};

/** What the page's GPU calls itself, through WebGPU and WebGL. */
async function adapterInfo() {
  const out: Record<string, unknown> = {};
  try {
    const a = await navigator.gpu?.requestAdapter();
    if (a) {
      const { vendor, architecture, device, description } = a.info;
      out.webgpu = { vendor, architecture, device, description };
    }
  } catch {}
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  if (gl && ext)
    out.webgl = {
      vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
    };
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return out;
}

const report = (body: Record<string, unknown>) => console.log(`__bench__ ${JSON.stringify(body)}`);

async function run() {
  const adapter = await adapterInfo();
  const handle = backend === 'webgpu' ? await gpu() : null;
  if (backend === 'webgpu' && !handle) {
    report({ error: 'no WebGPU device', adapter });
    return;
  }
  const { cols, rows } = shape(lights);
  const layers = Object.fromEntries(stack.filter((s) => s !== 'chase').map((s) => [s, true]));
  const frames: { t: number; mixMs: number; drawMs: number }[] = [];
  let start = Number.NaN;
  let measured = 0;
  let finish: () => void = () => {};
  const done = new Promise<void>((r) => {
    finish = r;
  });
  const canvas = document.getElementById('sign') as HTMLCanvasElement;
  const sign = createMarquee(canvas, {
    gpu: handle,
    backend,
    cols,
    rows,
    border: { bulbs: stack.includes('chase') ? 'chase' : 'unlit' },
    layers,
    program: [{ effect: 'scroll', text: 'BENCHMARKING THE MARQUEE AT SPEED', hex: 0xff9a2e }],
    onFrame({ raw }) {
      const now = performance.now();
      if (Number.isNaN(start)) start = now;
      frames.push({ t: now - start, ...raw });
      const t = now - start - WARMUP_MS;
      if (t >= 0) measured++;
      if ((t >= seconds * 1000 && measured >= FEWEST) || t >= seconds * 4000) finish();
    },
  });
  await done;
  const b = sign.board;
  const got = sign.backend;
  sign.destroy();
  report({
    backend,
    got,
    lights: b.dots.length + b.bulbs.length,
    cols: b.cols,
    rows: b.rows,
    stack,
    seconds,
    warmupMs: WARMUP_MS,
    canvas: { width: canvas.width, height: canvas.height, dpr: devicePixelRatio },
    adapter,
    frames,
  });
}

run().catch((e) => report({ error: String(e?.stack ?? e) }));
