import { afterEach, describe, expect, it, vi } from 'vitest';
import { surfacePlacement } from '@/readout/placement.js';
import { boardPlacement, toDevice, VIEW } from '@/render/placement.js';

describe('toDevice', () => {
  it('offsets, scales and slants a local point', () => {
    const views = new Float32Array(VIEW * 2);
    views.set([10, 20, 2, 0.25, 0, 0, 100, 100], VIEW);
    expect(toDevice(views, 1, 4, 8)).toEqual([10 + (4 - 2) * 2, 20 + 16]);
  });
});

describe('boardPlacement', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fits the canvas to its parent and makes one view a pitch per unit', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('devicePixelRatio', 2);
    const parent = { clientWidth: 200, clientHeight: 100 };
    const canvas = {
      parentElement: parent,
      style: {},
      width: 0,
      height: 0,
    } as never as HTMLCanvasElement;
    const p = boardPlacement(20, 5, () => undefined);
    let changed = 0;
    const stop = p.start(canvas, () => changed++);
    expect(changed).toBe(1);
    expect(p.pitch).toBe(20);
    expect([...p.views]).toEqual([0, 0, 20, 0, 0, 0, 400, 100]);
    expect(p.blur).toBe(true);
    stop();
  });

  it('sizes the canvas in device pixels as its CSS size times the pixel ratio', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('devicePixelRatio', 2);
    const style: Record<string, string> = {};
    const canvas = {
      parentElement: { clientWidth: 72.9, clientHeight: 145.8 },
      style,
      width: 0,
      height: 0,
    } as never as HTMLCanvasElement;
    const p = boardPlacement(1, 2, () => undefined);
    const stop = p.start(canvas, () => {});
    expect([style.width, style.height]).toEqual(['72px', '145px']);
    expect([canvas.width, canvas.height]).toEqual([144, 290]);
    expect(p.pitch).toBe(144);
    stop();
  });

  it('draws a canvas past the device limit at a lower pixel ratio, and says so once', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal('devicePixelRatio', 2);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const canvas = {
      parentElement: { clientWidth: 6000, clientHeight: 1000 },
      style: {},
      width: 0,
      height: 0,
    } as never as HTMLCanvasElement;
    const p = boardPlacement(60, 10, () => undefined);
    const stop = p.start(canvas, () => {}, 8192);
    expect(canvas.width).toBeLessThanOrEqual(8192);
    expect(canvas.height).toBe(Math.round((1000 * 8192) / 6000));
    p.refit();
    expect(warn).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('surfacePlacement', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a canvas with no CSS size from growing with its own pixels', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    let resized = () => {};
    const style: Record<string, string> = {};
    const canvas = { style, width: 300, height: 150 } as never as HTMLCanvasElement;
    // An unsized canvas's CSS box is its pixels, until the page gives it one.
    const box = (side: 'width' | 'height') =>
      style[side] ? Number.parseFloat(style[side]) : canvas[side];
    const p = surfacePlacement(() => [], {
      size: () => ({ width: box('width'), height: box('height') }),
      watch(_, r) {
        resized = r;
        return () => {};
      },
    });
    const stop = p.start(canvas, () => {});
    resized();
    resized();
    expect([style.width, style.height]).toEqual(['300px', '150px']);
    expect([canvas.width, canvas.height]).toEqual([600, 300]);
    stop();
  });

  it('lays its views at the ratio it sized the canvas at, under the device limit', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const canvas = { style: {}, width: 0, height: 0 } as never as HTMLCanvasElement;
    const box = {
      x: 4000,
      y: 0,
      width: 100,
      height: 50,
      clip: { x0: 0, y0: 0, x1: 8000, y1: 100 },
    };
    const spot = { width: 2, height: 1, cells: [] } as never;
    const p = surfacePlacement(() => [{ spot, slant: 0, box: () => box }], {
      size: () => ({ width: 8000, height: 100 }),
      watch: () => () => {},
    });
    const stop = p.start(canvas, () => {}, 8000);
    p.update();
    expect([canvas.width, canvas.height]).toEqual([8000, 100]);
    expect(p.views[0]).toBe(4000);
    stop();
  });
});
