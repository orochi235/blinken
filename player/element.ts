import {
  board,
  createMarquee,
  createTicker,
  frameOf,
  type Gpu,
  type GridName,
  gpu,
  gridOf,
  type Marquee,
  type Ticker,
} from '@/index.js';
import { borderOf, equip } from '../lab/compose/sign-hardware.js';
import { ATTRIBUTES, attributeSource, childSource, resolve, type Source } from './config.js';

/** One frame clock and one WebGPU request for every player on the page, asked for by the first. */
const pageTicker = createTicker();
let pageGpu: Promise<Gpu | null> | null = null;
function sharedGpu(): Promise<Gpu | null> {
  pageGpu ??= gpu().catch(() => null);
  return pageGpu;
}

/** `base`'s ticks, passed on only while `show(true)`: a player off screen draws nothing. */
function gated(base: Ticker): { ticker: Ticker; show(on: boolean): void } {
  const stops = new Map<(now: number) => void, (() => void) | null>();
  let on = true;
  return {
    ticker: {
      add(fn) {
        stops.set(fn, on ? base.add(fn) : null);
        return () => {
          stops.get(fn)?.();
          stops.delete(fn);
        };
      },
      get size() {
        return stops.size;
      },
    },
    show(next) {
      on = next;
      for (const [fn, stop] of stops) {
        if (on && !stop) stops.set(fn, base.add(fn));
        else if (!on && stop) {
          stop();
          stops.set(fn, null);
        }
      }
    },
  };
}

const STYLE = `
:host { display: block; }
:host([hidden]) { display: none; }
.box { width: 100%; aspect-ratio: var(--aspect, 10 / 1); display: flex; align-items: center; justify-content: center; }
canvas { display: block; }
`;

/**
 * Defines `<tag>`: a sign playing a composition. `baked` is what it plays and how its sign is built
 * when nothing on the page says otherwise; a `<script type="application/json">` inside it, then its
 * attributes, override that.
 */
export function definePlayer(tag = 'blinken-player', baked: Source = {}): void {
  if (customElements.get(tag)) return;
  customElements.define(
    tag,
    class BlinkenPlayer extends HTMLElement {
      static observedAttributes = ATTRIBUTES;
      readonly #box: HTMLDivElement;
      #sign: Marquee | null = null;
      #gate = gated(pageTicker);
      #seen = new IntersectionObserver((es) => {
        for (const e of es) this.#gate.show(e.isIntersecting);
      });
      /** Bumped by every rebuild, so a build still waiting on WebGPU knows it was overtaken. */
      #build = 0;

      constructor() {
        super();
        const root = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = STYLE;
        this.#box = document.createElement('div');
        this.#box.className = 'box';
        root.append(style, this.#box);
      }

      connectedCallback() {
        this.#seen.observe(this);
        this.#rebuild();
      }

      disconnectedCallback() {
        this.#seen.disconnect();
        this.#build++;
        this.#teardown();
      }

      attributeChangedCallback() {
        if (this.isConnected) this.#rebuild();
      }

      /** The sign playing now, for a page that wants to drive it. */
      get sign(): Marquee | null {
        return this.#sign;
      }

      #teardown() {
        this.#sign?.destroy();
        this.#sign = null;
        this.#box.replaceChildren();
      }

      async #rebuild() {
        const build = ++this.#build;
        // A burst of attribute changes builds once.
        await Promise.resolve();
        const handle = await sharedGpu();
        if (build !== this.#build || !this.isConnected) return;
        this.#teardown();
        const child = this.querySelector('script[type="application/json"]')?.textContent;
        const { decoded, hardware } = resolve([
          baked,
          childSource(child),
          attributeSource((name) => this.getAttribute(name)),
        ]);
        if (!decoded?.read) {
          console.error(`<${tag}> has no program it can read.`);
          return;
        }
        if (decoded.dropped.length)
          console.warn(`<${tag}> left out: ${decoded.dropped.join('; ')}.`);
        const { cols, rows } = hardware.size;
        const grid = hardware.size.grid as GridName;
        const bordered = hardware.border.bulbs !== 'none';
        const { across, down } = frameOf(board(cols, rows, bordered, grid), gridOf(grid));
        this.#box.style.setProperty('--aspect', `${across} / ${down}`);
        // A canvas that drew with WebGL or WebGPU can't be given to another backend, so each sign gets a new one.
        const canvas = document.createElement('canvas');
        this.#box.append(canvas);
        try {
          this.#sign = createMarquee(canvas, {
            cols,
            rows,
            grid,
            border: bordered && borderOf(hardware),
            program: decoded.state.program,
            effects: decoded.state.effects,
            gpu: handle,
            ticker: this.#gate.ticker,
          });
          equip(this.#sign, hardware);
        } catch (e) {
          console.error(e);
        }
      }
    },
  );
}
