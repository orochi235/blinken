import { oklab } from '@msb235/blits';
import { board } from '@/board.js';
import { signColumns } from '@/draw.js';
import { attach } from '@/render/attach.js';
import { boardLights } from '@/render/sign-lights.js';
import { createWebGpuSign } from '@/render/webgpu/sign.js';
import { readBack, test } from './harness.js';
import { canvasIn, handleOf } from './page.js';

const grid = (x: number, y: number): [number, number] => [x, y];
const b = board(10, 3, false);

/** The 10 × 3 sign, every third dot lit red. */
function scene() {
  const cols = signColumns(30);
  for (let i = 0; i < 30; i += 3) {
    cols.lit[i] = 1;
    cols.tint.set(oklab(0xff0000), i * 4);
  }
  return cols;
}

test('reshape: a WebGPU sign keeps its highlight and the sign it follows', async (d) => {
  const device = d as unknown as GPUDevice;
  const make = () =>
    createWebGpuSign(canvasIn(400, 200), b, b.dots, 'dark', grid, handleOf(device), null);
  const lead = make();
  const after = make();
  const mask = new Uint8Array(30);
  mask[1] = 1;
  lead.setHighlight(mask);
  const map = Uint32Array.from({ length: 30 }, (_, i) => 29 - i);
  after.setFollow({ lit: lead.output, map, planes: ['shape'] });
  lead.reshape(boardLights(b, b.dots, grid));
  after.setFollow({ lit: lead.output, map, planes: ['shape'] });
  after.reshape(boardLights(b, b.dots, grid));
  lead.render(scene(), 0xff9a2e, 16);
  after.render(signColumns(30), 0xff9a2e, 16);
  const pose = await readBack(device as never, lead.output as never, 0, 30 * 40);
  const follows = await readBack(device as never, after.output as never, 0, 30 * 40);
  lead.destroy();
  after.destroy();
  const at = (p: Float32Array, i: number, slot: number) => p[i * 10 + slot] as number;
  if (at(pose, 1, 9) !== 1) throw new Error(`after a reshape, dot 1's invert is ${at(pose, 1, 9)}`);
  for (let i = 0; i < 30; i++)
    if (at(follows, i, 0) !== at(pose, 29 - i, 0))
      throw new Error(
        `after a reshape, the follower's dot ${i} does not show the lead's ${29 - i}`,
      );
});

test('reshape: a drawing reads back the poses of the lights it draws now', async (d) => {
  const device = d as unknown as GPUDevice;
  const drawing = attach(canvasIn(400, 200), b, b.dots, {
    draw: true,
    backend: 'webgpu',
    gpu: handleOf(device),
    housing: 'dark',
    grid,
  });
  drawing.reshape(boardLights(b, b.dots, grid));
  const cols = scene();
  let poses: Float32Array | null = null;
  for (let k = 0; k < 20 && !poses; k++) {
    drawing.sign?.render(cols, 0xff9a2e, 16);
    poses = drawing.poses();
    await new Promise((r) => setTimeout(r, 20));
  }
  drawing.destroy();
  if (!poses) throw new Error('no poses read back after a reshape');
  if (poses[0] !== 1 || poses[10] !== 0)
    throw new Error(`poses read back lit ${poses[0]} and ${poses[10]}, not 1 and 0`);
});
