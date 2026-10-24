import { watched } from '@msb235/blits';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarquee } from '@/marquee.js';
import { createThumbnail } from '@/thumbnail.js';
import { createTicker } from '@/ticker.js';

let frames: FrameRequestCallback[];
let canceled: number;
let observers: { fire: (on: boolean) => void; observing: number }[];
let arcs: number;

/** Runs the frame requested last at `now`. */
const frame = (now: number) => (frames.shift() as FrameRequestCallback)(now);

/** A canvas whose 2D context does nothing but count the dots it is asked to draw. */
const fakeCanvas = () => {
  const ctx = new Proxy(
    {},
    {
      get: (_, key) => (key === 'arc' ? () => arcs++ : () => {}),
      set: () => true,
    },
  );
  return {
    getContext: () => ctx,
    style: {},
    width: 0,
    height: 0,
    parentElement: { clientWidth: 160, clientHeight: 56 },
  } as unknown as HTMLCanvasElement;
};

beforeEach(() => {
  frames = [];
  canceled = 0;
  observers = [];
  arcs = 0;
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => canceled++);
  vi.stubGlobal('document', { createElement: fakeCanvas });
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      readonly record: { fire: (on: boolean) => void; observing: number };
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        this.record = { fire: (on) => cb([{ isIntersecting: on }]), observing: 0 };
        observers.push(this.record);
      }
      observe() {
        this.record.observing++;
      }
      disconnect() {
        this.record.observing = 0;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTicker', () => {
  it('calls everything added from one animation frame, and stops when emptied', () => {
    const ticker = createTicker();
    const seen: string[] = [];
    const offA = ticker.add(() => seen.push('a'));
    const offB = ticker.add(() => seen.push('b'));
    expect(frames).toHaveLength(1);
    frame(16);
    expect(seen).toEqual(['a', 'b']);
    expect(frames).toHaveLength(1);
    offA();
    offB();
    expect(ticker.size).toBe(0);
    expect(canceled).toBe(1);
    ticker.add(() => {});
    expect(frames).toHaveLength(2);
  });

  it('ticks on every other 60 Hz frame at 30 fps', () => {
    const ticker = createTicker({ fps: 30 });
    const at: number[] = [];
    ticker.add((now) => at.push(now));
    for (let i = 1; i <= 6; i++) frame(i * (1000 / 60));
    expect(at.map(Math.round)).toEqual([17, 50, 83]);
  });
});

describe('createMarquee on a shared ticker', () => {
  it('runs every sign on it from one animation frame', () => {
    const ticker = createTicker();
    const a = createMarquee({} as HTMLCanvasElement, { draw: false, ticker });
    const b = createMarquee({} as HTMLCanvasElement, { draw: false, ticker });
    expect(ticker.size).toBe(2);
    expect(frames).toHaveLength(1);
    a.destroy();
    b.destroy();
    expect(ticker.size).toBe(0);
  });
});

describe('createThumbnail', () => {
  const listed = (name: string) =>
    watched()
      .entries()
      .filter((e) => e.name === name).length;

  it('loops its effect, drawing as it goes, and unlists its mix when destroyed', async () => {
    const ticker = createTicker();
    const thumb = createThumbnail(fakeCanvas(), { effect: 'scroll', ticker });
    expect(listed('thumbnail scroll')).toBe(1);
    expect(thumb.marquee.board.cols).toBe(32);
    expect(thumb.playing).toBe(true);

    let now = 16;
    frame(now);
    const length = thumb.marquee.pass()?.length ?? 0;
    expect(length).toBeGreaterThan(0);
    let wrapped = false;
    let was = 0;
    while (now < length * 1.5) {
      now += 50;
      frame(now);
      // A pass ends on a promise, so the next is cued a frame after it settles.
      await new Promise((r) => setTimeout(r, 0));
      const at = thumb.marquee.pass()?.at ?? 0;
      if (at < was) wrapped = true;
      was = at;
    }
    expect(wrapped).toBe(true);
    expect(arcs).toBeGreaterThan(0);

    thumb.destroy();
    expect(listed('thumbnail scroll')).toBe(0);
    expect(ticker.size).toBe(0);
    expect(observers[0]?.observing).toBe(0);
  });

  it('comes off the ticker while out of view and back on in view', () => {
    const ticker = createTicker();
    const one = createThumbnail(fakeCanvas(), { effect: 'hold', ticker });
    const two = createThumbnail(fakeCanvas(), { effect: 'flip', ticker });
    expect(ticker.size).toBe(2);
    observers[0]?.fire(false);
    expect(one.playing).toBe(false);
    expect(ticker.size).toBe(1);
    observers[1]?.fire(false);
    expect(ticker.size).toBe(0);
    expect(canceled).toBe(1);
    observers[0]?.fire(true);
    expect(one.playing).toBe(true);
    expect(ticker.size).toBe(1);
    one.destroy();
    two.destroy();
    expect(ticker.size).toBe(0);
    expect(two.playing).toBe(false);
  });

  it('draws a still once, lit, then leaves the ticker', () => {
    const ticker = createTicker();
    const canvas = fakeCanvas();
    const still = createThumbnail(canvas, { effect: 'hold', text: 'HI', ticker, still: 100 });
    expect(ticker.size).toBe(1);
    frame(16);
    expect(arcs).toBeGreaterThan(0);
    expect(ticker.size).toBe(0);
    expect(still.playing).toBe(false);
    still.destroy();
  });

  it('holds a still at a share of the pass', () => {
    const ticker = createTicker();
    const still = createThumbnail(fakeCanvas(), {
      effect: 'hold',
      text: 'HI',
      ticker,
      still: { share: 0.5 },
    });
    frame(16);
    const pass = still.marquee.pass();
    expect(pass?.at).toBeCloseTo((pass?.length ?? 0) / 2);
    still.destroy();
  });

  it('shares one ticker at 30 fps by default', () => {
    const one = createThumbnail(fakeCanvas(), { effect: 'hold' });
    const two = createThumbnail(fakeCanvas(), { effect: 'roll', text: 'HI', face: 'slim' });
    expect(frames).toHaveLength(1);
    one.destroy();
    two.destroy();
  });
});
