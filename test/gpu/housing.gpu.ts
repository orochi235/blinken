import { oklab } from '@msb235/blits';
import { board } from '@/board.js';
import { createSign, type Sign, signColumns } from '@/draw.js';
import type { Housing } from '@/render/housing.js';
import { lightTable } from '@/render/lights.js';
import { createWebGlSign } from '@/render/webgl/sign.js';
import { createWebGpuSign } from '@/render/webgpu/sign.js';
import { note, test } from './harness.js';
import { canvasIn, handleOf } from './page.js';

const PITCH = 24;
const BACKENDS = ['2d', 'webgl', 'webgpu'] as const;
type Kind = (typeof BACKENDS)[number];
const grid = (x: number, y: number): [number, number] => [x, y];

/**
 * Draws a 10 × 3 sign with no glow on `kind` round `housing`, every third dot lit red, and gives
 * each dot's center pixel and the pixel midway between the first two dots, as RGBA.
 */
function draw(kind: Kind, housing: Housing, device: GPUDevice) {
  const b = board(10, 3, false);
  const leds = b.dots;
  const cols = signColumns(leds.length);
  for (let i = 0; i < leds.length; i += 3) {
    cols.lit[i] = 1;
    cols.tint.set(oklab(0xff0000), i * 4);
  }
  const canvas = canvasIn(400, 200);
  const sign: Sign | null =
    kind === '2d'
      ? createSign(canvas, b, leds, housing, grid)
      : kind === 'webgl'
        ? createWebGlSign(canvas, b, leds, housing, grid)
        : createWebGpuSign(canvas, b, leds, housing, grid, handleOf(device), null);
  if (!sign) throw new Error(`no ${kind} sign`);
  sign.setLamps({ pitch: PITCH, glow: 0 });
  for (let k = 0; k < 4; k++) sign.render(cols, 0xff9a2e, 1000);
  const { width: w, height: h } = canvas;
  const copy = document.createElement('canvas');
  copy.width = w;
  copy.height = h;
  const cctx = copy.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  cctx.drawImage(canvas, 0, 0);
  const px = cctx.getImageData(0, 0, w, h).data;
  sign.destroy();
  const t = lightTable(b, leds, grid);
  const scale = w / t.frame.across;
  const at = (x: number, y: number) => {
    const k = (Math.floor(y * scale) * w + Math.floor(x * scale)) * 4;
    return [...px.subarray(k, k + 4)];
  };
  const centers = leds.map((_, i) => ({
    lit: cols.lit[i] === 1,
    px: at(t.at[i * 2] as number, t.at[i * 2 + 1] as number),
  }));
  const gap = at(
    ((t.at[0] as number) + (t.at[2] as number)) / 2,
    ((t.at[1] as number) + (t.at[3] as number)) / 2,
  );
  return { centers, gap };
}

for (const kind of BACKENDS) {
  test(`${kind}: a none housing shows only lit light; clear keeps the sockets, dark the backing`, async (d) => {
    const device = d as unknown as GPUDevice;
    const none = draw(kind, 'none', device);
    const clear = draw(kind, 'clear', device);
    const dark = draw(kind, 'dark', device);
    const unlit = (r: typeof none) => r.centers.filter((c) => !c.lit).map((c) => c.px);
    const lit = none.centers.filter((c) => c.lit).map((c) => c.px);
    note(
      `none: unlit center ${unlit(none)[0]}, lit ${lit[0]}, gap ${none.gap}; ` +
        `clear: unlit ${unlit(clear)[0]}, gap ${clear.gap}; dark: gap ${dark.gap}`,
    );
    if (unlit(none).some((p) => p.some((v) => v !== 0)))
      throw new Error(`none: an unlit dot shows ${unlit(none).find((p) => p.some((v) => v))}`);
    if (none.gap.some((v) => v !== 0)) throw new Error(`none: the gap shows ${none.gap}`);
    if (lit.some((p) => (p[0] as number) < 200 || (p[3] as number) < 200))
      throw new Error(`none: a lit dot shows ${lit.find((p) => (p[0] as number) < 200)}`);
    if (unlit(clear).some((p) => (p[3] as number) < 250))
      throw new Error(`clear: an unlit dot has no socket (${unlit(clear)[0]})`);
    if ((clear.gap[3] as number) !== 0) throw new Error(`clear: the gap shows ${clear.gap}`);
    if ((dark.gap[3] as number) < 250) throw new Error(`dark: the gap shows ${dark.gap}`);
  });
}
