import type { ReadoutOptions } from '@/readout/api.js';
import { createPanel } from '@/readout/panel.js';
import { TYPES } from '@/readout/types/index.js';
import type { Backend } from '@/render/backend.js';
import { note, test } from './harness.js';
import { canvasIn, handleOf, manual } from './page.js';

const HEIGHT = 100;
const AT = { x: 10, y: 10 };
const TOLERANCE = 24;

/** A panel on `backend` drawing `opts` at `AT`, stepped until its fade settles; its pixels via a 2D copy. */
async function drawn(
  device: GPUDevice,
  backend: Backend,
  opts: Omit<ReadoutOptions, 'at' | 'height'>,
) {
  const canvas = canvasIn(200, 140);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const ticker = manual();
  const panel = createPanel(canvas, {
    gpu: backend === 'webgpu' ? handleOf(device) : null,
    backend,
    ticker,
  });
  if (panel.backend !== backend) throw new Error(`asked for ${backend}, got ${panel.backend}`);
  panel.readout({ ...opts, at: AT, height: HEIGHT });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const t0 = performance.now();
  for (let k = 1; k <= 30; k++) ticker.step(t0 + k * 50);
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(canvas, 0, 0);
  panel.destroy();
  canvas.parentElement?.remove();
  return (x: number, y: number) => [...ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
}

/** Where a 7-segment cell's light `name` has its middle, in device pixels. */
function middleOf(name: string): [number, number] {
  const { cell } = TYPES.seven;
  const pad = cell.height / 15;
  const scale = (HEIGHT * devicePixelRatio) / (cell.height + pad * 2);
  const shape = cell.lights.find((l) => l.name === name)?.shapes[0];
  if (!shape) throw new Error(`no light ${name}`);
  const [mx, my] =
    shape.kind === 'bar'
      ? [(shape.x1 + shape.x2) / 2, (shape.y1 + shape.y2) / 2]
      : shape.kind === 'disc'
        ? [shape.x, shape.y]
        : (shape.points[0] as readonly [number, number]);
  return [
    AT.x * devicePixelRatio + (pad + mx) * scale,
    AT.y * devicePixelRatio + (pad + my) * scale,
  ];
}

const worst = (a: number[], b: number[]) =>
  Math.max(...[0, 1, 2].map((i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0))));

for (const backend of ['webgpu', 'webgl'] as const)
  test(`readouts: a 7-segment 8. on ${backend} lights each segment as 2D does`, async (d) => {
    const device = d as unknown as GPUDevice;
    const opts = { type: 'seven', cells: 1, value: '8.', color: 0xff3b1f } as const;
    const flat = await drawn(device, '2d', opts);
    const gpu = await drawn(device, backend, opts);
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
    const diffs = names.map((n) => worst(gpu(...middleOf(n)), flat(...middleOf(n))));
    const lit = flat(...middleOf('a'));
    note(
      `segment middles worst ${Math.max(...diffs)}/255 from 2D (a: ${gpu(...middleOf('a'))} vs ${lit})`,
    );
    if (!((lit[0] ?? 0) > 200)) throw new Error(`2D's lit segment a is ${lit}`);
    const bad = names.filter((_, i) => (diffs[i] ?? 0) > TOLERANCE);
    if (bad.length) throw new Error(`${bad.join(', ')} differ from 2D by over ${TOLERANCE}/255`);
  });

for (const backend of ['webgpu', 'webgl', '2d'] as const)
  test(`readouts: on ${backend}, a faceplate is dark and no face leaves the page showing`, async (d) => {
    const device = d as unknown as GPUDevice;
    const corner = (AT.x + 2) * devicePixelRatio;
    const opts = { type: 'seven', cells: 1, value: '1' } as const;
    const plated = (await drawn(device, backend, { ...opts, face: 'plate' }))(corner, corner);
    const bare = (await drawn(device, backend, { ...opts, face: 'none' }))(corner, corner);
    const unlit = (await drawn(device, backend, { ...opts, face: 'none' }))(...middleOf('a'));
    note(`plate ${plated}, bare ${bare}, an unlit segment bare ${unlit}`);
    if ((plated[3] ?? 0) < 250) throw new Error(`the faceplate's corner is ${plated}`);
    if ((bare[3] ?? 0) > 2) throw new Error(`with no face its corner is ${bare}`);
    if ((unlit[3] ?? 0) > 40) throw new Error(`with no face an unlit segment shows ${unlit}`);
  });
