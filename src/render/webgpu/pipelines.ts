import { rgb } from '../../color.js';
import { BLOOM, BULB_COLOR, DOT_COLOR, HOUSING } from '../bloom-params.js';
import { gaussian, TAPS } from '../blur.js';
import { LED, type LightTable } from '../lights.js';
import { BUFFER, STAGE, TEXTURE } from './usage.js';
import { BLUR_WGSL, BODY_WGSL, COPY_WGSL, GLOW_WGSL, HOUSING_WGSL } from './wgsl-draw.js';

/** How the lights are drawn this frame: the pitch in device pixels, and `Lamps`' size and glow. */
export interface Look {
  readonly pitch: number;
  readonly lamp: number;
  readonly glow: number;
}

/** The WebGL sign's draw (`webgl/sign.ts`) in WebGPU, from the optics' `shows` buffer. */
export interface Painter {
  /** Makes the targets for a canvas `w` × `h` and paints the housing into one. */
  size(w: number, h: number, look: Look, backed: boolean): void;
  /** Records the frame into `enc`, drawn to `view`. */
  draw(enc: GPUCommandEncoder, view: GPUTextureView, look: Look): void;
  destroy(): void;
}

const GLOW = 'rgba16float';
/** A blur's uniforms: its step, then its weights four to a vec4. */
const BLUR_FLOATS = 4 + 4 * Math.ceil((TAPS + 1) / 4);
const HOUSE = 'rgba8unorm';
const ADD: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one' },
  alpha: { srcFactor: 'one', dstFactor: 'one' },
};
const OVER: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
};

interface Target {
  readonly tex: GPUTexture;
  readonly view: GPUTextureView;
}

export function createPainter(
  device: GPUDevice,
  format: GPUTextureFormat,
  table: LightTable,
  shows: GPUBuffer,
): Painter {
  const n = table.n;
  const V = STAGE.VERTEX;
  const F = STAGE.FRAGMENT;
  const lightLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: V | F, buffer: { type: 'uniform' } },
      { binding: 1, visibility: V, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: V, buffer: { type: 'read-only-storage' } },
    ],
  });
  const texEntries: GPUBindGroupLayoutEntry[] = [
    { binding: 0, visibility: F, sampler: { type: 'filtering' } },
    { binding: 1, visibility: F, texture: { sampleType: 'float' } },
  ];
  const copyLayout = device.createBindGroupLayout({ entries: texEntries });
  const blurLayout = device.createBindGroupLayout({
    entries: [...texEntries, { binding: 2, visibility: F, buffer: { type: 'uniform' } }],
  });
  const pipe = (
    code: string,
    layout: GPUBindGroupLayout,
    to: GPUTextureFormat,
    blend: GPUBlendState | undefined,
    strip: boolean,
  ) => {
    const module = device.createShaderModule({ code });
    return device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: { module, entryPoint: 'vs' },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: to, ...(blend ? { blend } : {}) }],
      },
      primitive: { topology: strip ? 'triangle-strip' : 'triangle-list' },
    });
  };
  const housing = pipe(HOUSING_WGSL, lightLayout, HOUSE, OVER, true);
  const glow = pipe(GLOW_WGSL, lightLayout, GLOW, ADD, true);
  const body = pipe(BODY_WGSL, lightLayout, format, ADD, true);
  const blur = pipe(BLUR_WGSL, blurLayout, GLOW, undefined, false);
  const copy = pipe(COPY_WGSL, copyLayout, format, undefined, false);
  const copyAdd = pipe(COPY_WGSL, copyLayout, format, ADD, false);

  const fixedData = new Float32Array(Math.max(n, 1) * 4);
  for (let i = 0; i < n; i++)
    fixedData.set(
      [table.at[i * 2] ?? 0, table.at[i * 2 + 1] ?? 0, table.radius[i] ?? 0, table.shape[i] ?? 0],
      i * 4,
    );
  const fixed = device.createBuffer({
    size: fixedData.byteLength,
    usage: BUFFER.STORAGE | BUFFER.COPY_DST,
  });
  device.queue.writeBuffer(fixed, 0, fixedData);
  const uniform = (size: number) =>
    device.createBuffer({ size, usage: BUFFER.UNIFORM | BUFFER.COPY_DST });
  const lightU = uniform(80);
  const blurU = [uniform(BLUR_FLOATS * 4), uniform(BLUR_FLOATS * 4)] as const;
  const lights = device.createBindGroup({
    layout: lightLayout,
    entries: [lightU, fixed, shows].map((buffer, binding) => ({ binding, resource: { buffer } })),
  });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const lightData = new Float32Array(20);
  lightData.set([LED.core, LED.coreAlpha], 5);
  lightData.set([...rgb(DOT_COLOR), 1, ...rgb(BULB_COLOR), 1, ...rgb(LED.coreTint), 1], 8);

  let canvas = { w: 0, h: 0 };
  let half = { w: 1, h: 1 };
  let targets: { house: Target; splat: Target; across: Target; blurred: Target } | null = null;
  let groups: {
    house: GPUBindGroup;
    blurX: GPUBindGroup;
    blurY: GPUBindGroup;
    blurred: GPUBindGroup;
  } | null = null;

  const target = (w: number, h: number, f: GPUTextureFormat): Target => {
    const tex = device.createTexture({
      size: [w, h],
      format: f,
      usage: TEXTURE.RENDER_ATTACHMENT | TEXTURE.TEXTURE_BINDING,
    });
    return { tex, view: tex.createView() };
  };
  const texGroup = (layout: GPUBindGroupLayout, t: Target, u?: GPUBuffer) =>
    device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: t.view },
        ...(u ? [{ binding: 2, resource: { buffer: u } }] : []),
      ],
    });
  const writeLook = (look: Look) => {
    lightData.set([canvas.w, canvas.h, look.pitch, look.lamp, look.glow], 0);
    device.queue.writeBuffer(lightU, 0, lightData);
  };
  const drop = () => {
    for (const t of Object.values(targets ?? {})) t.tex.destroy();
    targets = null;
    groups = null;
  };
  const instances = (enc: GPURenderPassEncoder, p: GPURenderPipeline) => {
    enc.setPipeline(p);
    enc.setBindGroup(0, lights);
    enc.draw(4, n);
  };
  const full = (enc: GPURenderPassEncoder, p: GPURenderPipeline, g: GPUBindGroup) => {
    enc.setPipeline(p);
    enc.setBindGroup(0, g);
    enc.draw(3);
  };
  const into = (enc: GPUCommandEncoder, view: GPUTextureView, clear: GPUColor = [0, 0, 0, 0]) =>
    enc.beginRenderPass({
      colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: clear }],
    });
  /** Writes the weights of a blur `sigma` texels of `src` wide into `u`, along x or y. */
  const weigh = (u: GPUBuffer, sigma: number, src: { w: number; h: number }, x: boolean) => {
    const { weights, spacing } = gaussian(sigma);
    const data = new Float32Array(BLUR_FLOATS);
    data.set([x ? spacing / src.w : 0, x ? 0 : spacing / src.h], 0);
    data.set(weights, 4);
    device.queue.writeBuffer(u, 0, data);
  };

  return {
    size(w, h, look, backed) {
      drop();
      canvas = { w, h };
      half = { w: Math.max(1, Math.ceil(w / 2)), h: Math.max(1, Math.ceil(h / 2)) };
      if (w === 0 || h === 0) return;
      const t = {
        house: target(w, h, HOUSE),
        splat: target(w, h, GLOW),
        across: target(half.w, half.h, GLOW),
        blurred: target(half.w, half.h, GLOW),
      };
      targets = t;
      groups = {
        house: texGroup(copyLayout, t.house),
        blurX: texGroup(blurLayout, t.splat, blurU[0]),
        blurY: texGroup(blurLayout, t.across, blurU[1]),
        blurred: texGroup(copyLayout, t.blurred),
      };
      writeLook(look);
      const enc = device.createCommandEncoder();
      const [hr, hg, hb] = backed ? rgb(HOUSING) : [0, 0, 0];
      const pass = into(enc, t.house.view, [hr, hg, hb, backed ? 1 : 0]);
      instances(pass, housing);
      pass.end();
      device.queue.submit([enc.finish()]);
    },
    draw(enc, view, look) {
      const t = targets;
      const g = groups;
      if (!t || !g) return;
      writeLook(look);
      const sigma = look.pitch * BLOOM.spread * look.glow;
      const glows = sigma > 0;
      if (glows) {
        weigh(blurU[0], sigma, canvas, true);
        weigh(blurU[1], sigma / 2, half, false);
        const splat = into(enc, t.splat.view);
        instances(splat, glow);
        splat.end();
        const across = into(enc, t.across.view);
        full(across, blur, g.blurX);
        across.end();
        const blurred = into(enc, t.blurred.view);
        full(blurred, blur, g.blurY);
        blurred.end();
      }
      const out = into(enc, view);
      full(out, copy, g.house);
      // As in 2D, glow and bodies both add onto the housing.
      if (glows) full(out, copyAdd, g.blurred);
      instances(out, body);
      out.end();
    },
    destroy() {
      drop();
      for (const b of [fixed, lightU, ...blurU]) b.destroy();
    },
  };
}
