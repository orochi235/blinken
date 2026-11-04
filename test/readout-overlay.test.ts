import { afterEach, describe, expect, it, vi } from 'vitest';
import { boxOf } from '@/readout/overlay.js';
import { surfacePlacement } from '@/readout/placement.js';

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const el = (r: ReturnType<typeof rect>, connected = true) =>
  ({ isConnected: connected, getBoundingClientRect: () => r }) as unknown as Element;

describe('the overlay', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('clips a readout’s element where a scrolling ancestor clips it', () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    const pane = el(rect(0, 100, 400, 200));
    const box = boxOf(el(rect(50, 250, 100, 100)), [pane]);
    expect(box?.clip).toEqual({ x0: 50, y0: 250, x1: 150, y1: 300 });
  });

  it('shows nothing for an element scrolled out of its pane, detached, or of no size', () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    const pane = el(rect(0, 100, 400, 200));
    expect(boxOf(el(rect(50, 400, 100, 40)), [pane])).toBeNull();
    expect(boxOf(el(rect(50, 150, 100, 40), false), [pane])).toBeNull();
    expect(boxOf(el(rect(50, 150, 0, 0)), [pane])).toBeNull();
  });

  it('fits a readout inside its box, aspect kept and centered', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const clip = { x0: 0, y0: 0, x1: 1000, y1: 1000 };
    const p = surfacePlacement(
      () => [
        {
          spot: { base: 0, first: 0, width: 10, height: 20 },
          slant: 0,
          box: () => ({ x: 0, y: 0, width: 100, height: 40, clip }),
        },
      ],
      { size: () => ({ width: 1000, height: 1000 }), watch: () => () => {} },
    );
    expect(p.update()).toBe(true);
    const scale = (40 / 20) * 2;
    expect([...p.views.slice(0, 4)]).toEqual([(200 - 10 * scale) / 2, 0, scale, 0]);
    expect(p.update()).toBe(false);
  });
});
