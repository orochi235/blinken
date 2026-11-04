import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
