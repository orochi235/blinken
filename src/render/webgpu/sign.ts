import type { Board, Led } from '../../board.js';
import type { Lamps, Sign } from '../../draw.js';
import type { Grid } from '../../grid.js';
import { CHANNELS, type SignColumns } from '../../optics.js';
import { fitCanvas } from '../fit.js';
import type { Gpu } from '../gpu.js';
import { LAMP_SIZE, lightTable } from '../lights.js';
import { createGpuOptics } from './optics.js';
import { createPainter, type Look } from './pipelines.js';
import { type ChannelSource, createSources, type Follow, planOf } from './sources.js';

export type { ChannelSource, Follow } from './sources.js';

/** A sign drawn with WebGPU, which also lays a followed sign's planes and a highlight on the GPU. */
export interface WebGpuSign extends Sign {
  readonly backend: 'webgpu';
  /** Swaps how lit each dot whose entry is 1 shows; null clears it. */
  setHighlight(mask: Uint8Array | null): void;
  /** Lays another sign's planes over this one's dots, from its `output`; null stops. */
  setFollow(from: Follow | null): void;
  /** Ten numbers per light, each channel at its `SLOT`: the poses the optics read, for a follower. */
  readonly output: GPUBuffer;
  /**
   * The channels the next render reads from the columns rather than the source's buffer, dots and
   * bulbs alike. It holds until the source's mix syncs or changes again, or the source starts or
   * stops keeping a channel on the CPU.
   */
  cpuChannels(): ReadonlySet<keyof SignColumns>;
}

/**
 * A sign like `createSign`'s, drawn with WebGPU on `handle`'s device. Each frame it reads every
 * channel `source` folds on the GPU straight from its buffer, and the rest from the columns; the
 * source's subjects are `b.dots` then `b.cells`, and `leds` must be `b.dots` then `b.bulbs`. Once
 * the device is lost it draws nothing.
 */
export function createWebGpuSign(
  canvas: HTMLCanvasElement,
  b: Board,
  leds: readonly Led[],
  backed: boolean,
  grid: Grid,
  handle: Gpu,
  source: ChannelSource | null,
): WebGpuSign {
  const { device, format } = handle;
  const ctx = canvas.getContext('webgpu') as GPUCanvasContext | null;
  if (!ctx) throw new Error('bree: this canvas has no WebGPU context to give');
  ctx.configure({ device, format, alphaMode: 'premultiplied' });
  const table = lightTable(b, leds, grid);
  const sources = createSources(device, b);
  const optics = createGpuOptics(device, b, leds, sources.pose);
  const painter = createPainter(device, format, table, optics.shows);
  let lamps: Lamps = {};
  let pitch = 0;
  const lost = watchLost(handle);
  let off = false;
  let gone = false;

  const look = (): Look => ({
    pitch,
    lamp: lamps.size ?? LAMP_SIZE,
    glow: Math.max(lamps.glow ?? 1, 0),
  });
  /** Runs `work`, and stops drawing for good where the device refuses it. */
  const guard = (work: () => void) => {
    if (off || lost.off) return;
    try {
      work();
    } catch (e) {
      off = true;
      console.error(e);
    }
  };
  const fit = fitCanvas(
    canvas,
    table.frame.across,
    table.frame.down,
    () => lamps.pitch,
    (next) => {
      pitch = next;
      guard(() => painter.size(canvas.width, canvas.height, look(), backed));
    },
  );

  return {
    backend: 'webgpu',
    output: sources.pose,
    cpuChannels() {
      const plan = planOf(source);
      return new Set(CHANNELS.filter((_, c) => plan[c] === null));
    },
    render(cols, fallback, dt) {
      guard(() => {
        const enc = device.createCommandEncoder();
        sources.gather(enc, cols, source);
        optics.step(enc, fallback, dt, Math.max(lamps.brightness ?? 1, 0));
        if (canvas.width > 0 && canvas.height > 0)
          painter.draw(enc, ctx.getCurrentTexture().createView(), look());
        device.queue.submit([enc.finish()]);
      });
    },
    setDefects(defects) {
      guard(() => optics.setDefects(defects));
    },
    setFade(next) {
      optics.setFade(next);
    },
    setGhost(next) {
      optics.setGhost(next);
    },
    setLamps(next) {
      lamps = next;
      fit.refit();
    },
    setHighlight(mask) {
      guard(() => sources.setHighlight(mask));
    },
    setFollow(from) {
      guard(() => sources.setFollow(from));
    },
    destroy() {
      if (gone) return;
      gone = true;
      off = true;
      fit.stop();
      try {
        painter.destroy();
        optics.destroy();
        sources.destroy();
        ctx.unconfigure();
      } catch {}
    },
  };
}

/**
 * A flag set once `handle`'s device is lost. It lives outside the sign's scope, since the handle
 * outlives its signs and its `lost` promise would otherwise hold every sign ever made.
 */
function watchLost(handle: Gpu): { off: boolean } {
  const state = { off: false };
  void handle.lost.then(() => {
    state.off = true;
  });
  return state;
}
