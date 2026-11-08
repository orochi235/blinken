import { describe, expect, it } from 'vitest';
import { reclaim, shedContext } from '@/render/webgl/context.js';

const lostGl = { isContextLost: () => true, getExtension: () => null } as never;

describe('shedContext', () => {
  it('leaves a context the page lost for the next sign on its canvas, to draw once restored', () => {
    const canvas = new EventTarget() as HTMLCanvasElement;
    shedContext(canvas, lostGl);
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    const cancel = reclaim(canvas);
    expect(cancel).not.toBeNull();
    cancel?.();
    expect(reclaim(canvas)).not.toBeNull();
  });

  it('gives nothing to reclaim on a canvas no sign of ours lost', () => {
    expect(reclaim(new EventTarget() as HTMLCanvasElement)).toBeNull();
  });
});
