import { patch } from '@msb235/blits';
import { gpuOf, shaderPatch } from '@msb235/blits/gpu';
import type { Pose, Subject } from '@/board.js';
import { gridOf } from '@/grid.js';
import { createMarquee } from '@/marquee.js';
import type { Marquee, MarqueeOptions } from '@/marquee-api.js';
import { drawingOf } from '@/render/attach.js';
import type { Gpu } from '@/render/gpu.js';
import { lightTable } from '@/render/lights.js';
import type { WebGpuSign } from '@/render/webgpu/sign.js';
import type { Ticker } from '@/ticker.js';
import { note, test } from './harness.js';

const PITCH = 12;
const TOLERANCE = 8;
const FRAME_MS = 16;
/** The last frame of the 500 ms played, ms. */
const LAST = 31 * FRAME_MS;

const handleOf = (device: GPUDevice): Gpu => ({
  device,
  format: navigator.gpu.getPreferredCanvasFormat(),
  lost: device.lost.then(() => {}),
});

function canvasIn(width: number, height: number): HTMLCanvasElement {
  const box = document.createElement('div');
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  const canvas = document.createElement('canvas');
  box.append(canvas);
  document.body.append(box);
  return canvas;
}

/** A ticker the test steps by hand. */
function manual(): Ticker & { step(now: number): void } {
  const fns = new Set<(now: number) => void>();
  return {
    add(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    get size() {
      return fns.size;
    },
    step(now) {
      for (const fn of fns) fn(now);
    },
  };
}

const SIGN: MarqueeOptions = {
  cols: 24,
  rows: 7,
  program: [{ effect: 'scroll', text: 'HI THERE', hex: 0x30c0ff }],
  fade: { rise: 0, fall: 0 },
  lamps: { pitch: PITCH },
};

/** Lights every other column of dots, and the border's cells. */
const LIGHT = shaderPatch<Subject, Pose, Record<string, never>>(1000, {
  fields: { x: 'f32', cell: 'f32' },
  wgsl: 'out.lit = select(select(0.0, 1.0, fract(subject.x * 0.5) < 0.25), 1.0, subject.cell > 0.5);',
  at: (_phase, s) => ({ lit: s.kind === 'cell' || s.x % 2 === 0 ? 1 : 0 }),
  writes: ['lit'],
});

/** Dims the dots toward the left, and the border's cells, less as its loop goes on, on the CPU. */
const DIM = patch<Subject, Pose>(
  1000,
  (phase, s) => ({ gain: s.kind === 'cell' ? 0.3 + 0.5 * phase : 0.2 + 0.03 * s.x + 0.4 * phase }),
  {
    writes: ['gain'],
  },
);

const CHANNELS = ['lit', 'gain', 'tint', 'hue', 'chroma', 'glow', 'invert'];

/** Every light's center pixel on `canvas`, read through a 2D copy. */
function centers(m: Marquee, canvas: HTMLCanvasElement): number[][] {
  const b = m.board;
  const leds = [...b.dots, ...b.bulbs];
  const t = lightTable(b, leds, gridOf());
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(canvas, 0, 0);
  const scale = canvas.width / t.frame.across;
  return leds.map((_, i) => {
    const x = Math.floor((t.at[i * 2] as number) * scale);
    const y = Math.floor((t.at[i * 2 + 1] as number) * scale);
    return [...ctx.getImageData(x, y, 1, 1).data];
  });
}

const worst = (a: readonly number[], b: readonly number[]) =>
  Math.max(...[0, 1, 2].map((k) => Math.abs((a[k] as number) - (b[k] as number))));

/** Steps `ticker` from `from` to `to` ms, waiting for the GPU side's kernel after the first frame. */
async function play(m: Marquee, ticker: ReturnType<typeof manual>, from: number, to: number) {
  for (let now = from; now <= to; now += FRAME_MS) {
    ticker.step(now);
    if (now === from) await gpuOf(m.mix).ready;
  }
}

/**
 * Plays `opts` on WebGPU for 500 ms, then draws a 2D twin held at the same moment, and checks every
 * light's center against it. Gives the channels the GPU folded and those pulled on the CPU.
 */
async function againstTwin(
  device: GPUDevice,
  opts: MarqueeOptions,
  cue: (m: Marquee) => void = () => {},
): Promise<{ folded: string[]; cpu: string[] }> {
  const ticker = manual();
  const cg = canvasIn(400, 140);
  const g = createMarquee(cg, { ...opts, gpu: handleOf(device), ticker });
  if (g.backend !== 'webgpu') throw new Error(`backend ${g.backend}`);
  cue(g);
  await play(g, ticker, 0, LAST);
  const cpu = [...(drawingOf(g)?.cpuChannels() ?? [])];
  const side = gpuOf(g.mix);
  const folded = CHANNELS.filter((c) => side.channel(c) !== null);
  note(
    `folded on the GPU: ${folded.join(', ') || 'none'}; pulled on the CPU: ${cpu.join(', ') || 'none'}`,
  );
  for (const c of folded)
    if (cpu.includes(c as never)) throw new Error(`${c} folds on the GPU and is pulled too`);
  if (folded.length + cpu.length !== 7) throw new Error('a channel is neither folded nor pulled');

  const at = g.pass()?.at ?? 0;
  const twinTicker = manual();
  const c2 = canvasIn(400, 140);
  const flat = createMarquee(c2, { ...opts, backend: '2d', ticker: twinTicker });
  cue(flat);
  flat.seek(at, { hold: true });
  // Stepped through the frames the WebGPU sign was, since a gap past 250 ms counts no time.
  for (let now = 0; now <= LAST; now += FRAME_MS) twinTicker.step(now);
  if (c2.width !== cg.width || c2.height !== cg.height)
    throw new Error(`WebGPU canvas ${cg.width}×${cg.height}, 2D ${c2.width}×${c2.height}`);
  // The WebGPU canvas is read in the task that drew it, before it is presented and cleared.
  ticker.step(LAST);
  const gpuPx = centers(g, cg);
  const flatPx = centers(flat, c2);
  const lit = flat.columns.lit;
  let diff = 0;
  let lights = 0;
  for (let i = 0; i < gpuPx.length; i++) {
    diff = Math.max(diff, worst(gpuPx[i] as number[], flatPx[i] as number[]));
    if ((lit[i] as number) > 0) lights++;
  }
  note(
    `at ${at.toFixed(0)} ms, ${lights} of ${lit.length} lights lit; centers worst ${diff}/255 from 2D`,
  );
  g.destroy();
  flat.destroy();
  if (lights === 0) throw new Error('the 2D twin shows nothing lit');
  if (diff > TOLERANCE) throw new Error(`a light's center is ${diff}/255 from 2D's`);
  return { folded, cpu };
}

test('marquee: plays scroll on WebGPU, drawing what a held 2D twin does', async (d) => {
  await againstTwin(d as unknown as GPUDevice, SIGN);
});

test('marquee: folds a shader patch on the GPU and pulls only what the CPU folds', async (d) => {
  const { cpu } = await againstTwin(d as unknown as GPUDevice, { ...SIGN, program: [] }, (m) => {
    // The built-in layers wait at weight 0 as fn patches, which would keep every channel on the CPU.
    for (const v of m.mix.voices()) v.fade({ over: 0 });
    const all = [...m.board.dots, ...m.board.cells];
    m.mix.cue({ name: 'light', patch: LIGHT, subjects: all, loop: true });
    m.mix.cue({ name: 'dim', patch: DIM, subjects: all, loop: true });
  });
  if (cpu.join() !== 'gain') throw new Error(`pulled ${cpu.join(', ')}, not just gain`);
});

test('marquee: a WebGPU follower lays its leader on the GPU, and lets go once it is destroyed', async (d) => {
  const device = d as unknown as GPUDevice;
  const handle = handleOf(device);
  const ticker = manual();
  const lead = createMarquee(canvasIn(400, 140), { ...SIGN, gpu: handle, ticker });
  let source: Marquee | null = lead;
  const after = createMarquee(canvasIn(400, 140), {
    ...SIGN,
    gpu: handle,
    ticker,
    follow: { source: () => source, planes: ['color'] },
  });
  const sign = drawingOf(after)?.webgpu as WebGpuSign;
  const calls: (string | null)[] = [];
  const setFollow = sign.setFollow.bind(sign);
  sign.setFollow = (from) => {
    calls.push(from ? `${from.planes.join(',')} ${from.map.length}` : null);
    setFollow(from);
  };
  ticker.step(0);
  ticker.step(FRAME_MS);
  lead.destroy();
  ticker.step(2 * FRAME_MS);
  source = null;
  ticker.step(3 * FRAME_MS);
  after.destroy();
  const want = [`color ${after.board.dots.length}`, null];
  if (JSON.stringify(calls) !== JSON.stringify(want))
    throw new Error(`setFollow got ${JSON.stringify(calls)}, not ${JSON.stringify(want)}`);
});

test('marquee: a WebGPU sign highlights on the GPU, leaving its columns alone', async (d) => {
  const device = d as unknown as GPUDevice;
  const ticker = manual();
  const m = createMarquee(canvasIn(400, 140), { ...SIGN, gpu: handleOf(device), ticker });
  const sign = drawingOf(m)?.webgpu as WebGpuSign;
  const masks: (number | null)[] = [];
  const setHighlight = sign.setHighlight.bind(sign);
  sign.setHighlight = (mask) => {
    masks.push(mask ? mask.reduce((a, x) => a + x, 0) : null);
    setHighlight(mask);
  };
  ticker.step(0);
  const before = [...m.columns.invert];
  m.setHighlight((dot) => dot.x < 2);
  m.setHighlight(null);
  ticker.step(FRAME_MS);
  m.destroy();
  if (JSON.stringify(masks) !== JSON.stringify([14, null]))
    throw new Error(`setHighlight got ${JSON.stringify(masks)}`);
  if (JSON.stringify([...m.columns.invert]) !== JSON.stringify(before))
    throw new Error('the highlight changed the columns');
});

test('marquee: a 2D sign following a WebGPU sign reads its poses back', async (d) => {
  const ticker = manual();
  const lead = createMarquee(canvasIn(400, 140), {
    ...SIGN,
    gpu: handleOf(d as unknown as GPUDevice),
    ticker,
  });
  lead.seek(300, { hold: true });
  const after = createMarquee(canvasIn(400, 140), {
    ...SIGN,
    backend: '2d',
    ticker,
    program: [{ effect: 'hold', text: 'WW', hex: 0xff0000 }],
    follow: { source: () => lead, planes: ['shape'] },
  });
  for (let k = 0; k < 10; k++) {
    ticker.step(k * FRAME_MS);
    await new Promise((r) => setTimeout(r, 20));
  }
  const want = [...lead.columns.lit.subarray(0, lead.board.dots.length)];
  const got = [...after.columns.lit.subarray(0, after.board.dots.length)];
  lead.destroy();
  after.destroy();
  if (!want.some((v) => v > 0)) throw new Error('the leader shows nothing lit');
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error('the follower does not show the leader’s lit dots');
});
