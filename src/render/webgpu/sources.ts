import type { GpuChannel } from '@msb235/blits/gpu';
import type { Board } from '../../board.js';
import { axesOf, CHANNELS, type SignColumns } from '../../optics.js';
import { PLANES, type Plane } from '../../planes.js';
import { layoutOf } from './bindings.js';
import { BUFFER } from './usage.js';
import { GATHER_BINDINGS, GATHER_WGSL, GROUP, POSE, SLOT } from './wgsl-optics.js';

/** Where the GPU folds a mix's channels: `gpuOf(m)` is one. */
export interface ChannelSource {
  channel(name: keyof SignColumns): GpuChannel | null;
}

/** Another sign's poses to lay over this one's dots: `map` gives, per dot, the light it copies. */
export interface Follow {
  readonly lit: GPUBuffer;
  readonly map: Uint32Array;
  readonly planes: readonly Plane[];
}

/** Every light's pose, gathered on the GPU each frame from the mix's buffers or its columns. */
export interface Sources {
  /** Ten numbers per light, `SLOT` placing each channel. */
  readonly pose: GPUBuffer;
  /** Records this frame's gather into `enc`, uploading what `source` leaves to the CPU. */
  gather(enc: GPUCommandEncoder, cols: SignColumns, source: ChannelSource | null): void;
  setHighlight(mask: Uint8Array | null): void;
  setFollow(from: Follow | null): void;
  destroy(): void;
}

/**
 * Gathers poses for `b`'s lights, dots then bulbs. A source's subjects are the dots then the
 * cells, so bulb `j` reads subject `dots + cellOf[j]`; the columns are already in light order.
 */
export function createSources(device: GPUDevice, b: Board): Sources {
  const STORAGE_IN = BUFFER.STORAGE | BUFFER.COPY_DST;
  const dots = b.dots.length;
  const n = dots + b.bulbs.length;
  const buffer = (bytes: number, usage: number, label: string) =>
    device.createBuffer({ size: Math.max(16, bytes), usage, label: `blinken ${label}` });
  const pose = buffer(n * POSE * 4, BUFFER.STORAGE | BUFFER.COPY_SRC, 'pose');
  const cpu = buffer(n * POSE * 4, STORAGE_IN, 'columns');
  const staging = new Float32Array(n * POSE);
  const info = new Uint32Array(n * 4);
  for (let i = 0; i < n; i++) info[i * 4] = i < dots ? i : dots + (b.cellOf[i - dots] as number);
  const infoBuf = buffer(info.byteLength, STORAGE_IN, 'light info');
  device.queue.writeBuffer(infoBuf, 0, info);
  const head = new Uint32Array(4 + CHANNELS.length * 4);
  const uniform = buffer(head.byteLength, BUFFER.UNIFORM | BUFFER.COPY_DST, 'gather');
  const empty = buffer(16, BUFFER.STORAGE, 'nothing');
  const { layout, group: groupOf } = layoutOf(device, GATHER_BINDINGS);
  const pipeline = device.createComputePipeline({
    layout,
    compute: { module: device.createShaderModule({ code: GATHER_WGSL }), entryPoint: 'main' },
  });
  const plan: (GpuChannel | null)[] = [];
  let follow: Follow | null = null;
  let group: { src: GPUBuffer; from: GPUBuffer; group: GPUBindGroup } | null = null;

  const bindings = (src: GPUBuffer, from: GPUBuffer) => {
    if (group?.src === src && group.from === from) return group.group;
    const made = groupOf([uniform, src, cpu, infoBuf, from, pose]);
    group = { src, from, group: made };
    return made;
  };

  return {
    pose,
    gather(enc, cols, source) {
      let src: GPUBuffer | null = null;
      head[0] = n;
      head[1] = dots;
      head[2] = follow ? followMask(follow.planes) : 0;
      planOf(source, plan);
      for (let c = 0; c < CHANNELS.length; c++) {
        const on = plan[c];
        const name = CHANNELS[c] as (typeof CHANNELS)[number];
        const axes = axesOf(name);
        const base = n * SLOT[name];
        if (on) {
          src = on.buffer as GPUBuffer;
          head.set([1, on.offset / 4, on.stride / 4, 0], 4 + c * 4);
          continue;
        }
        head.set([0, base, axes, 0], 4 + c * 4);
        const col = cols[name];
        for (let k = 0; k < n * axes; k++) staging[base + k] = col[k] ?? 0;
        device.queue.writeBuffer(cpu, base * 4, staging, base, n * axes);
      }
      device.queue.writeBuffer(uniform, 0, head);
      if (n === 0) return;
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings(src ?? empty, follow?.lit ?? empty));
      pass.dispatchWorkgroups(Math.ceil(n / GROUP));
      pass.end();
    },
    setHighlight(mask) {
      for (let i = 0; i < dots; i++) info[i * 4 + 1] = mask?.[i] ? 1 : 0;
      device.queue.writeBuffer(infoBuf, 0, info);
    },
    setFollow(from) {
      follow = from;
      for (let i = 0; i < dots; i++) info[i * 4 + 2] = from?.map[i] ?? 0;
      device.queue.writeBuffer(infoBuf, 0, info);
    },
    destroy() {
      for (const b of [pose, cpu, infoBuf, uniform, empty]) b.destroy();
    },
  };
}

/**
 * Where a gather reads each channel this frame, in `CHANNELS` order, written into `into`:
 * `source`'s buffer, or null for the columns. The channels read from the GPU must all share one
 * buffer.
 */
export function planOf(
  source: ChannelSource | null,
  into: (GpuChannel | null)[] = [],
): (GpuChannel | null)[] {
  let src: unknown = null;
  for (let c = 0; c < CHANNELS.length; c++) {
    const on = source?.channel(CHANNELS[c] as (typeof CHANNELS)[number]) ?? null;
    const ok = on?.buffer && on.offset % 4 === 0 && (src === null || src === on.buffer);
    if (ok) src = on.buffer;
    into[c] = ok ? on : null;
  }
  return into;
}

/** One bit per pose number the followed planes carry. */
function followMask(planes: readonly Plane[]): number {
  let mask = 0;
  for (const plane of planes)
    for (const c of PLANES[plane]) {
      const slot = SLOT[c];
      for (let a = 0; a < axesOf(c); a++) mask |= 1 << (slot + a);
    }
  return mask;
}
