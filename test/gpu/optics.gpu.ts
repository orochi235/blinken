import { oklab } from '@msb235/blits';
import type { GpuChannel } from '@msb235/blits/gpu';
import { board } from '@/board.js';
import { type Defect, scatter } from '@/defects.js';
import { paintBulbs, signColumns } from '@/draw.js';
import { hash } from '@/hash.js';
import type { SignColumns } from '@/optics.js';
import { createOpticsFrame, lit } from '@/render/optics-frame.js';
import { createGpuOptics } from '@/render/webgpu/optics.js';
import { type ChannelSource, createSources } from '@/render/webgpu/sources.js';
import { BUFFER } from '@/render/webgpu/usage.js';
import { HASH_WGSL } from '@/render/wgsl-hash.js';
import { close, note, readBack, test } from './harness.js';

/** A seeded 0..1 stream, so a failure replays. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** Random columns for `n` subjects, covering every branch of the optics and `dotColor`. */
function randomColumns(n: number, r: () => number): SignColumns {
  const c = signColumns(n);
  const colors = [0xff0000, 0x3060c0, 0x20ff60, 0xffffff, 0x101010, 0xff9a2e];
  for (let i = 0; i < n; i++) {
    c.lit[i] = r() < 0.2 ? 0 : r() * 1.4 - 0.2;
    c.gain[i] = r() * 1.5;
    const lab = oklab(colors[Math.floor(r() * colors.length)] as number);
    const pick = r();
    const cover = pick < 0.2 ? 0 : pick < 0.5 ? r() : pick < 0.8 ? 1 : 1 + r();
    for (let k = 0; k < 3; k++) c.tint[i * 4 + k] = (lab[k] as number) * cover;
    c.tint[i * 4 + 3] = cover;
    c.hue[i] = r() < 0.4 ? 0 : r() * 720 - 360;
    c.chroma[i] = r() < 0.4 ? 1 : r() * 2;
    c.glow[i] = r() * 2;
    c.invert[i] = r() < 0.6 ? 0 : r() * 1.4 - 0.2;
  }
  return c;
}

const CHANNELS = ['lit', 'gain', 'tint', 'hue', 'chroma', 'glow', 'invert'] as const;

/**
 * `cells` and the dots' columns in GPU buffers laid out as blits lays its output, subject after
 * subject per channel, from an odd offset; `keep` names the channels the CPU fills instead.
 */
function fakeSource(
  device: GPUDevice,
  dots: SignColumns,
  cells: SignColumns,
  nDots: number,
  keep: readonly string[],
): ChannelSource {
  const subjects = nDots + 3;
  const place = new Map<string, GpuChannel>();
  const data: number[] = [0, 0, 0, 0];
  for (const name of CHANNELS) {
    const axes = name === 'tint' ? 4 : 1;
    const offset = data.length * 4;
    for (let s = 0; s < subjects; s++)
      for (let a = 0; a < axes; a++)
        data.push(
          s < nDots ? (dots[name][s * axes + a] ?? 0) : (cells[name][(s - nDots) * axes + a] ?? 0),
        );
    place.set(name, { buffer: null as never, offset, stride: axes * 4, axes });
  }
  const buffer = device.createBuffer({
    size: data.length * 4,
    usage: BUFFER.STORAGE | BUFFER.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, new Float32Array(data));
  return {
    channel(name) {
      const p = place.get(name);
      if (!p || keep.includes(name)) return null;
      return { ...p, buffer: buffer as unknown as GpuChannel['buffer'] };
    },
  };
}

const DTS = [16, 1000 / 3, 0, 7];

/** Steps the CPU optics and the GPU optics through `DTS`, comparing what each light shows. */
async function agree(device: GPUDevice, source: 'cpu' | 'gpu', ghost: boolean) {
  const r = random(source === 'cpu' ? 11 : 12);
  const b = board(48, 40, true);
  const leds = [...b.dots, ...b.bulbs];
  const n = leds.length;
  const dotCols = randomColumns(b.dots.length, r);
  const cellCols = randomColumns(b.cells.length, r);
  const cols = signColumns(n);
  for (const name of CHANNELS) cols[name].set(dotCols[name]);
  paintBulbs(b, cellCols, cols);
  const defects: Defect[] = [
    ...scatter(b, { dead: 0.1, dim: 0.1, flicker: 0.3, stuck: 0.1 }, 5),
    { kind: 'flicker', at: { bulb: 0 }, rate: 9, duty: 0.3 },
    { kind: 'stuck', at: { bulb: 1 }, level: 0.4 },
    // Within 2^-32 of 1: no hash reaches it, so this light never drops out.
    { kind: 'flicker', at: { bulb: 2 }, rate: 50, duty: 1 - 2 ** -33 },
  ];
  const cpu = createOpticsFrame(b, leds);
  const sources = createSources(device, b);
  const gpu = createGpuOptics(device, b, leds, sources.pose);
  const look = ghost ? { row: 0.3, col: 0.2 } : {};
  for (const o of [cpu, gpu]) {
    o.setDefects(defects);
    o.setGhost(look);
    o.setFade({ rise: 20, fall: 90 });
  }
  const fake =
    source === 'gpu' ? fakeSource(device, dotCols, cellCols, b.dots.length, ['hue']) : null;
  const out = lit(n);
  let shineWorst = 0;
  let rgbWorst = 0;
  let edges = 0;
  let clock = 0;
  for (const dt of DTS) {
    clock += dt;
    // A flicker step that sits within f32 of a whole number may land either side of it.
    const near = defects.some((d) => {
      if (d.kind !== 'flicker') return false;
      const x = (clock / 1000) * (d.rate ?? 6);
      return Math.abs(x - Math.round(x)) < 1e-5 * Math.max(1, x);
    });
    if (near) edges++;
    cpu.step(cols, 0xff9a2e, dt, 0.8, out);
    const enc = device.createCommandEncoder();
    sources.gather(enc, cols, fake);
    gpu.step(enc, 0xff9a2e, dt, 0.8);
    device.queue.submit([enc.finish()]);
    if (near) continue;
    const got = await readBack(device as never, gpu.shows as never, 0, n * 20);
    for (let i = 0; i < n; i++) {
      const want = out.shine[i] as number;
      const shine = got[i * 5] as number;
      close(got[i * 5 + 4] as number, out.bloom[i] as number, `bloom ${i}`);
      if ((want === 0) !== (shine === 0)) {
        // Either side of the 0.02 a light must show to be drawn.
        if (Math.max(want, shine) > 0.0201) close(shine, want, `shine ${i} at dt ${dt}`);
        continue;
      }
      close(shine, want, `shine ${i} at dt ${dt}`);
      shineWorst = Math.max(shineWorst, Math.abs(shine - want));
      if (want === 0) continue;
      for (let k = 0; k < 3; k++) {
        const d = Math.abs((got[i * 5 + 1 + k] as number) - (out.rgb[i * 3 + k] as number));
        rgbWorst = Math.max(rgbWorst, d);
        if (d > 1 / 255 + 1e-6)
          throw new Error(
            `rgb ${i}[${k}] at dt ${dt}: GPU ${got[i * 5 + 1 + k]}, CPU ${out.rgb[i * 3 + k]}`,
          );
      }
    }
  }
  sources.destroy();
  gpu.destroy();
  note(
    `${n} lights, ${source} columns, ghost ${ghost ? 'on' : 'off'}: shine worst ${shineWorst.toExponential(2)}, ` +
      `rgb worst ${(rgbWorst * 255).toFixed(2)}/255, steps skipped at a flicker edge ${edges}`,
  );
}

test('optics: the GPU step agrees with optics-frame, from uploaded columns, ghost on', (d) =>
  agree(d as unknown as GPUDevice, 'cpu', true));
test('optics: the GPU step agrees with optics-frame, from uploaded columns, ghost off', (d) =>
  agree(d as unknown as GPUDevice, 'cpu', false));
test('optics: the GPU step agrees from the mix’s buffers, bulbs through their cells', (d) =>
  agree(d as unknown as GPUDevice, 'gpu', true));

test('optics: the WGSL hash gives the TS hash’s bits', async (gd) => {
  const device = gd as unknown as GPUDevice;
  const r = random(3);
  const n = 1 << 16;
  const xyz = new Int32Array(n * 4);
  for (let i = 0; i < n; i++) {
    xyz[i * 4] =
      i < 64 ? ([0, -1, 2 ** 31 - 1, -(2 ** 31)][i % 4] as number) : Math.floor(r() * 2 ** 32) | 0;
    xyz[i * 4 + 1] = Math.floor(r() * 2e6) - 1e6;
    xyz[i * 4 + 2] = Math.floor(r() * 100);
  }
  const input = device.createBuffer({
    size: xyz.byteLength,
    usage: BUFFER.STORAGE | BUFFER.COPY_DST,
  });
  device.queue.writeBuffer(input, 0, xyz);
  const output = device.createBuffer({
    size: n * 8,
    usage: BUFFER.STORAGE | BUFFER.COPY_SRC,
  });
  const code = `${HASH_WGSL}
@group(0) @binding(0) var<storage, read> xyz: array<vec4i>;
@group(0) @binding(1) var<storage, read_write> out: array<vec2u>;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  let p = xyz[id.x];
  out[id.x] = vec2u(bree_hash_u32(p.x, p.y, p.z), bitcast<u32>(bree_hash(p.x, p.y, p.z)));
}`;
  const pipe = device.createComputePipeline({
    layout: 'auto',
    compute: { module: device.createShaderModule({ code }), entryPoint: 'main' },
  });
  const enc = device.createCommandEncoder();
  const pass = enc.beginComputePass();
  pass.setPipeline(pipe);
  pass.setBindGroup(
    0,
    device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [input, output].map((buffer, binding) => ({ binding, resource: { buffer } })),
    }),
  );
  pass.dispatchWorkgroups(n / 64);
  pass.end();
  device.queue.submit([enc.finish()]);
  const raw = await readBack(device as never, output as never, 0, n * 8);
  const bits = new Uint32Array(raw.buffer);
  let wrong = 0;
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const want = hash(xyz[i * 4] as number, xyz[i * 4 + 1] as number, xyz[i * 4 + 2] as number);
    if ((bits[i * 2] as number) / 0x1_0000_0000 !== want) wrong++;
    worst = Math.max(worst, Math.abs((raw[i * 2 + 1] as number) - want));
  }
  input.destroy();
  output.destroy();
  note(`${n} hashes: ${wrong} differ in their bits; as f32, worst ${worst.toExponential(2)}`);
  if (wrong > 0) throw new Error(`${wrong} of ${n} hashes differ from TS`);
  if (worst > 2 ** -24) throw new Error(`the f32 hash is ${worst} from TS`);
});
