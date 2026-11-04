import { board } from '@/board.js';
import { createSign, type Sign, signColumns } from '@/draw.js';
import { GRIDS } from '@/grid.js';
import { lightTable } from '@/render/lights.js';
import { createWebGlSign } from '@/render/webgl/sign.js';
import { createWebGpuSign } from '@/render/webgpu/sign.js';
import { note, test } from './harness.js';
import { canvasIn, handleOf } from './page.js';

const PITCH = 30;
const TOLERANCE = 12;
const worst = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Math.max(...[0, 1, 2].map((k) => Math.abs((a[k] as number) - (b[k] as number))));

/** Every light's middle pixel on a sign of triangles, lit in a checker, through a 2D copy. */
function middles(make: (canvas: HTMLCanvasElement) => Sign | null) {
  const b = board(12, 4, false, 'triangles');
  const leds = b.dots;
  const canvas = canvasIn(400, 200);
  const sign = make(canvas);
  if (!sign) throw new Error('no sign');
  sign.setLamps({ pitch: PITCH });
  const cols = signColumns(leds.length);
  for (const [i, d] of leds.entries()) cols.lit[i] = (d.x + d.y) % 3 === 0 ? 1 : 0;
  for (let k = 0; k < 4; k++) sign.render(cols, 0xff9a2e, 1000);
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.drawImage(canvas, 0, 0);
  const t = lightTable(b, leds, GRIDS.triangles);
  const scale = canvas.width / t.frame.across;
  const out = leds.map((_, i) => [
    ...ctx.getImageData(
      Math.floor((t.at[i * 2] as number) * scale),
      Math.floor((t.at[i * 2 + 1] as number) * scale),
      1,
      1,
    ).data,
  ]);
  sign.destroy();
  canvas.parentElement?.remove();
  return { out, lit: [...cols.lit] };
}

for (const backend of ['webgl', 'webgpu'] as const)
  test(`triangles: each triangle's middle on ${backend} matches 2D`, async (d) => {
    const device = d as unknown as GPUDevice;
    const flat = middles((c) =>
      createSign(
        c,
        board(12, 4, false, 'triangles'),
        board(12, 4, false, 'triangles').dots,
        true,
        GRIDS.triangles,
      ),
    );
    const gpu = middles((c) => {
      const b = board(12, 4, false, 'triangles');
      return backend === 'webgl'
        ? createWebGlSign(c, b, b.dots, true, GRIDS.triangles)
        : createWebGpuSign(c, b, b.dots, true, GRIDS.triangles, handleOf(device), null);
    });
    const diffs = flat.out.map((px, i) => worst(px, gpu.out[i] as number[]));
    const lit = flat.out.filter((_, i) => flat.lit[i] === 1);
    note(
      `worst ${Math.max(...diffs)}/255 from 2D; a lit middle ${lit[0]} on 2D, ${gpu.out[flat.lit.indexOf(1)]} on ${backend}`,
    );
    if (!((lit[0]?.[0] ?? 0) > 200)) throw new Error(`2D's lit triangle shows ${lit[0]}`);
    if (Math.max(...diffs) > TOLERANCE)
      throw new Error(`a middle is ${Math.max(...diffs)}/255 from 2D's`);
  });
