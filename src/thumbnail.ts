import { board } from './board.js';
import type { EffectSpec } from './effects.js';
import { type Look, ROWS, rasterize } from './font.js';
import { createMarquee, type Marquee } from './marquee.js';
import { rowsToShow } from './orders.js';
import { createTicker, type Ticker } from './ticker.js';

export interface ThumbnailOptions extends Look {
  /** The effect it loops: a built-in's name, one of `effects`, or a spec. */
  readonly effect: string | EffectSpec;
  /** Effects `effect` can name, ahead of the built-ins. */
  readonly effects?: Readonly<Record<string, EffectSpec>>;
  /** The message. Default `OPEN`, which fits the default board in every face. */
  readonly text?: string;
  /** Its color. Default amber. */
  readonly hex?: number;
  /** Dots across and down. Default 32 across and as many rows as show every dot of the text, at least 7. */
  readonly cols?: number;
  readonly rows?: number;
  /** The clock it animates on. Default one every thumbnail shares, at 30 fps. */
  readonly ticker?: Ticker;
  /** A moment of the pass, ms, to draw once and hold, for a still preview instead of a loop. */
  readonly still?: number;
}

export interface Thumbnail {
  /** The sign it plays on, for `setProgram` and `setEffects` when the effect changes. */
  readonly marquee: Marquee;
  /** Whether it is animating: false while scrolled out of view. */
  readonly playing: boolean;
  /** Stops it, lets go of the canvas, and takes its mix off the debuggers' list. */
  destroy(): void;
}

let shared: Ticker | undefined;
/** The ticker thumbnails share by default, made at first use. */
const thumbnails = () => {
  shared ??= createTicker({ fps: 30 });
  return shared;
};

/**
 * A small sign on `canvas` looping one effect, for a preview: no layers, no border chase. It
 * animates only while the canvas is in view, on a ticker shared with every other thumbnail.
 */
export function createThumbnail(canvas: HTMLCanvasElement, opts: ThumbnailOptions): Thumbnail {
  const inner = opts.ticker ?? thumbnails();
  let tick: ((now: number) => void) | null = null;
  let off: (() => void) | null = null;
  let visible = true;
  const gate = () => {
    if (visible && tick && !off) off = inner.add(tick);
    else if ((!visible || !tick) && off) {
      off();
      off = null;
    }
  };
  // Still, a thumbnail leaves the ticker once it has drawn onto a canvas with a size; sizing the
  // canvas clears it, so a resize draws it again.
  let redraw: (() => void) | null = null;
  // The marquee's frame loop runs through this, so scrolling out of view takes it off the ticker.
  const gated: Ticker = {
    add(fn) {
      const once = (now: number) => {
        fn(now);
        if (canvas.width === 0) return;
        tick = null;
        gate();
      };
      redraw = () => {
        tick = once;
        gate();
      };
      tick = opts.still === undefined ? fn : once;
      gate();
      return () => {
        tick = null;
        gate();
      };
    },
    get size() {
      return inner.size;
    },
  };

  const name = typeof opts.effect === 'string' ? opts.effect : opts.effect.name;
  const cols = opts.cols ?? 32;
  const text = opts.text ?? 'OPEN';
  const rows = opts.rows ?? rowsToShow(board(cols, ROWS), rasterize(text, opts));
  const marquee = createMarquee(canvas, {
    cols,
    rows,
    effects: opts.effects,
    program: [
      {
        effect: opts.effect,
        text,
        hex: opts.hex ?? 0xff9a2e,
        face: opts.face,
        style: opts.style,
      },
    ],
    ticker: gated,
    name: `thumbnail ${name}`,
  });

  if (opts.still !== undefined) {
    marquee.seek(opts.still, { hold: true });
    // One frame is all a still gets, and a frame after a long wait counts no time, so the dots'
    // warm-up would leave them dark.
    marquee.setFade({ rise: 0, fall: 0 });
  }
  const resized =
    opts.still === undefined || typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => redraw?.());
  // The sign resizes, and so clears, its canvas when this box changes, its first layout included.
  resized?.observe(canvas.parentElement ?? canvas);

  const watch =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          const last = entries[entries.length - 1];
          if (!last) return;
          visible = last.isIntersecting;
          gate();
        });
  watch?.observe(canvas);

  const handle: Thumbnail = {
    marquee,
    get playing() {
      return off !== null;
    },
    destroy() {
      watch?.disconnect();
      resized?.disconnect();
      marquee.destroy();
    },
  };
  return handle;
}
