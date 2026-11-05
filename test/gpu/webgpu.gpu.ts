import { oklab } from '@msb235/blits';
import type { GpuChannel } from '@msb235/blits/gpu';
import { board } from '@/board.js';
import { createSign, signColumns } from '@/draw.js';
import type { SignColumns } from '@/optics.js';
import { DOT_COLOR } from '@/render/bloom-params.js';
import { lightTable } from '@/render/lights.js';
import { type ChannelSource, createWebGpuSign } from '@/render/webgpu/sign.js';
import { BUFFER } from '@/render/webgpu/usage.js';
import { note, readBack, test } from './harness.js';
import { canvasIn, handleOf } from './page.js';

const PITCH = 24;
const TOLERANCE = 8;
/** How far the total light emitted may stray from 2D's, as a share of it. */
const LIGHT_TOLERANCE = 0.05;

/** `cols` as blits lays its output, subject after subject per channel; null for `cpu`'s channels. */
function sourceOf(device: GPUDevice, cols: SignColumns, n: number, cpu: string[]): ChannelSource {
  const names = ['lit', 'gain', 'tint', 'hue', 'chroma', 'glow', 'invert'] as const;
  const data = new Float32Array(n * 10);
  const at = new Map<string, number>();
  let k = 0;
  for (const name of names) {
    at.set(name, k * 4);
    data.set(cols[name], k);
    k += name === 'tint' ? n * 4 : n;
  }
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: BUFFER.STORAGE | BUFFER.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return {
    channel(name) {
      if (cpu.includes(name)) return null;
      const axes = name === 'tint' ? 4 : 1;
      const offset = at.get(name) as number;
      return { buffer: buffer as unknown as GpuChannel['buffer'], offset, stride: axes * 4, axes };
    },
  };
}

const rgbOf = (hex: number) => [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
const worst = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Math.max(...[0, 1, 2].map((k) => Math.abs((a[k] as number) - (b[k] as number))));
const sum = (px: ArrayLike<number>) => {
  let t = 0;
  for (let k = 0; k < px.length; k++) if (k % 4 !== 3) t += px[k] as number;
  return t;
};

/**
 * Draws `cols` on a 2D sign and a WebGPU one, and reads each light's center pixel from each, and
 * how much light each sign shows over its unlit housing.
 */
function drawBoth(
  device: GPUDevice,
  cols: SignColumns,
  glow: number,
  opts: { cpu?: string[]; brightness?: number } = {},
) {
  const b = board(10, 3, false);
  const leds = b.dots;
  const c2 = canvasIn(400, 200);
  const cw = canvasIn(400, 200);
  const flat = createSign(c2, b, leds);
  const source = opts.cpu ? sourceOf(device, cols, leds.length, opts.cpu) : null;
  const gpu = createWebGpuSign(cw, b, leds, 'dark', (x, y) => [x, y], handleOf(device), source);
  const lamps = { pitch: PITCH, glow, brightness: opts.brightness };
  flat.setLamps(lamps);
  gpu.setLamps(lamps);
  const ctx = c2.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const { width: w, height: h } = c2;
  if (cw.width !== w || cw.height !== h)
    throw new Error(`canvas ${cw.width}×${cw.height}, 2D ${w}×${h}`);
  flat.render(signColumns(leds.length), 0, 16);
  const housing = sum(ctx.getImageData(0, 0, w, h).data);
  for (let k = 0; k < 4; k++) {
    flat.render(cols, 0xff9a2e, 1000);
    gpu.render(cols, 0xff9a2e, 1000);
  }
  const copy = document.createElement('canvas');
  copy.width = w;
  copy.height = h;
  const cctx = copy.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  cctx.drawImage(cw, 0, 0);
  const whole = cctx.getImageData(0, 0, w, h).data;
  const emitted = {
    flat: sum(ctx.getImageData(0, 0, w, h).data) - housing,
    gpu: sum(whole) - housing,
  };
  const t = lightTable(b, leds, (x, y) => [x, y]);
  const scale = w / t.frame.across;
  const pairs = leds.map((_, i) => {
    const x = Math.floor((t.at[i * 2] as number) * scale);
    const y = Math.floor((t.at[i * 2 + 1] as number) * scale);
    const k = (y * w + x) * 4;
    return {
      lit: (cols.lit[i] as number) > 0,
      flat: [...ctx.getImageData(x, y, 1, 1).data],
      gpu: [...whole.subarray(k, k + 4)],
    };
  });
  flat.destroy();
  gpu.destroy();
  return { pairs, emitted };
}

/** The 10 × 3 sign, every third dot lit `color`. */
function scene(color: number): SignColumns {
  const cols = signColumns(30);
  const tint = oklab(color);
  for (let i = 0; i < 30; i += 3) {
    cols.lit[i] = 1;
    cols.tint.set(tint, i * 4);
  }
  return cols;
}

/** Checks lit and dark centers and the light emitted against 2D. */
function compare(name: string, got: ReturnType<typeof drawBoth>): void {
  const lit = got.pairs.filter((p) => p.lit);
  const diff = Math.max(...lit.map((p) => worst(p.gpu, p.flat)));
  const dark = Math.max(0, ...got.pairs.filter((p) => !p.lit).map((p) => worst(p.gpu, p.flat)));
  const ratio = got.emitted.gpu / got.emitted.flat;
  note(
    `${name}: lit centers worst ${diff}/255 from 2D (${lit[0]?.gpu} vs ${lit[0]?.flat}); ` +
      `dark centers worst ${dark}/255; light emitted ${ratio.toFixed(3)}× 2D's`,
  );
  if (diff > TOLERANCE) throw new Error(`${name}: a lit center is ${diff}/255 from 2D's`);
  if (dark > TOLERANCE) throw new Error(`${name}: a dark center is ${dark}/255 from 2D's`);
  if (Math.abs(ratio - 1) > LIGHT_TOLERANCE)
    throw new Error(`${name}: emits ${ratio.toFixed(3)}× 2D's light`);
}

const LOOKS = [
  { name: 'red', color: 0xff0000, brightness: 1 },
  { name: 'dim blue', color: 0x3060c0, brightness: 0.6 },
];

test('webgpu: each lit dot’s center matches 2D', async (d) => {
  for (const look of LOOKS)
    compare(look.name, drawBoth(d as unknown as GPUDevice, scene(look.color), 1, look));
});

test('webgpu: from the mix’s buffers, with the CPU filling hue, colors match 2D', async (d) => {
  const cols = scene(0xff0000);
  for (let i = 0; i < 30; i++) {
    cols.lit[i] = 1;
    cols.hue[i] = i * 12;
  }
  compare('rainbow', drawBoth(d as unknown as GPUDevice, cols, 1, { cpu: ['hue'] }));
});

test('webgpu: a dark dot shows its socket, with no glow', async (d) => {
  const { pairs } = drawBoth(d as unknown as GPUDevice, scene(0xff0000), 0);
  const socket = rgbOf(DOT_COLOR);
  const diff = Math.max(...pairs.filter((p) => !p.lit).map((p) => worst(p.gpu, socket)));
  note(`dark centers: worst ${diff}/255 from the socket`);
  if (diff > TOLERANCE) throw new Error(`a dark dot is ${diff}/255 from its socket`);
});

test('webgpu: a 0 × 0 canvas renders, and destroy twice is fine', async (d) => {
  const b = board(10, 3, false);
  const s = createWebGpuSign(
    canvasIn(0, 0),
    b,
    b.dots,
    'dark',
    (x, y) => [x, y],
    handleOf(d as unknown as GPUDevice),
    null,
  );
  if (s.backend !== 'webgpu') throw new Error(`backend ${s.backend}`);
  s.render(scene(0xff0000), 0xff9a2e, 16);
  s.destroy();
  s.destroy();
});

test('webgpu: a destroyed device draws nothing and does not throw', async () => {
  const adapter = await navigator.gpu.requestAdapter();
  const device = (await adapter?.requestDevice()) as GPUDevice;
  const b = board(10, 3, false);
  const s = createWebGpuSign(
    canvasIn(400, 200),
    b,
    b.dots,
    'dark',
    (x, y) => [x, y],
    handleOf(device),
    null,
  );
  s.setLamps({ pitch: PITCH });
  s.render(scene(0xff0000), 0xff9a2e, 16);
  device.destroy();
  s.render(scene(0xff0000), 0xff9a2e, 16);
  s.setDefects([]);
  s.setHighlight(new Uint8Array(30));
  await device.lost;
  s.render(scene(0xff0000), 0xff9a2e, 16);
  s.setLamps({ pitch: PITCH + 1 });
  s.destroy();
});

test('webgpu: a destroyed sign is not kept alive by its device', async (d) => {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (!gc) throw new Error('run with --js-flags=--expose-gc');
  const handle = handleOf(d as unknown as GPUDevice);
  const made = (): WeakRef<HTMLCanvasElement> => {
    const canvas = canvasIn(400, 200);
    const b = board(10, 3, false);
    const s = createWebGpuSign(canvas, b, b.dots, 'dark', (x, y) => [x, y], handle, null);
    s.render(scene(0xff0000), 0xff9a2e, 16);
    s.destroy();
    canvas.parentElement?.remove();
    return new WeakRef(canvas);
  };
  const ref = made();
  for (let k = 0; k < 10 && ref.deref(); k++) {
    await new Promise((r) => setTimeout(r, 50));
    gc();
  }
  if (ref.deref()) throw new Error('the destroyed sign’s canvas is still reachable');
});

test('webgpu: a highlight swaps a dot’s invert, and a follower copies the planes it follows', async (d) => {
  const device = d as unknown as GPUDevice;
  const b = board(10, 3, false);
  const grid = (x: number, y: number): [number, number] => [x, y];
  const lead = createWebGpuSign(
    canvasIn(400, 200),
    b,
    b.dots,
    'dark',
    grid,
    handleOf(device),
    null,
  );
  const after = createWebGpuSign(
    canvasIn(400, 200),
    b,
    b.dots,
    'dark',
    grid,
    handleOf(device),
    null,
  );
  const mask = new Uint8Array(30);
  mask[1] = 1;
  lead.setHighlight(mask);
  const map = Uint32Array.from({ length: 30 }, (_, i) => 29 - i);
  after.setFollow({ lit: lead.output, map, planes: ['shape'] });
  const cols = scene(0xff0000);
  cols.invert[2] = 0.25;
  lead.render(cols, 0xff9a2e, 16);
  after.render(signColumns(30), 0xff9a2e, 16);
  const pose = await readBack(device as never, lead.output as never, 0, 30 * 40);
  const follows = await readBack(device as never, after.output as never, 0, 30 * 40);
  lead.destroy();
  after.destroy();
  const at = (p: Float32Array, i: number, slot: number) => p[i * 10 + slot] as number;
  if (at(pose, 1, 9) !== 1) throw new Error(`dot 1's invert is ${at(pose, 1, 9)}, not 1`);
  if (at(pose, 2, 9) !== 0.25) throw new Error(`dot 2's invert is ${at(pose, 2, 9)}`);
  for (let i = 0; i < 30; i++) {
    if (at(follows, i, 0) !== at(pose, 29 - i, 0) || at(follows, i, 9) !== at(pose, 29 - i, 9))
      throw new Error(`the follower's dot ${i} does not show the lead's dot ${29 - i}`);
    if (at(follows, i, 2) !== 0) throw new Error(`the follower took dot ${i}'s color too`);
  }
});
