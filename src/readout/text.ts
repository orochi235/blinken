import type { Spot } from './layout.js';
import type { Fit } from './placement.js';

const STYLE = `
.blinken-text { position: absolute; pointer-events: none; overflow: hidden; }
.blinken-text-fixed { position: fixed; inset: 0; }
.blinken-text-readout { position: absolute; inset: 0; }
.blinken-text-cell {
  position: absolute; box-sizing: border-box; margin: 0; padding: 0;
  pointer-events: auto; cursor: text; user-select: text; -webkit-user-select: text;
  color: transparent; background: transparent; white-space: pre; overflow: hidden;
  font-family: ui-monospace, monospace; text-align: center; transform-origin: 0 0;
}
.blinken-text-cell::selection { color: transparent; background: color-mix(in srgb, Highlight 45%, transparent); }
`;
const styled = new WeakSet<Document>();

function style(doc: Document): void {
  if (styled.has(doc)) return;
  styled.add(doc);
  const sheet = doc.createElement('style');
  sheet.textContent = STYLE;
  doc.head.append(sheet);
}

/**
 * See-through text over a surface's readouts, a box per cell holding the characters it shows, so
 * the page's own selection, copy and screen readers reach them. A selected cell shows as a block of
 * the selection color: inverting its segments, as a dot sign's highlight does, lights every segment
 * its character leaves dark and makes it unreadable.
 */
export interface TextLayer {
  /** Makes boxes for each readout's cells, by readout order; `null` for one that can't be selected. */
  build(spots: readonly (Spot | null)[]): void;
  /** Sets readout `i`'s cells' characters, a cell's '' for a blank. */
  write(i: number, cells: readonly string[]): void;
  /** Moves every box to where its readout is drawn now. */
  place(fits: readonly (Fit | null)[]): void;
  destroy(): void;
}

/**
 * A text layer beside `canvas`: over its box, or fixed over the viewport for an overlay's.
 */
export function createTextLayer(canvas: HTMLCanvasElement, fixed: boolean): TextLayer {
  const doc = canvas.ownerDocument;
  style(doc);
  const layer = doc.createElement('div');
  layer.className = fixed ? 'blinken-text blinken-text-fixed' : 'blinken-text';
  canvas.after(layer);
  let readouts: ({
    spot: Spot;
    group: HTMLElement;
    texts: Text[];
    cells: HTMLElement[];
    /** Its fit when last placed, so an unmoved readout isn't restyled. */
    at: string;
  } | null)[] = [];
  return {
    build(spots) {
      layer.replaceChildren();
      readouts = spots.map((spot) => {
        if (!spot) return null;
        const group = doc.createElement('div');
        group.className = 'blinken-text-readout';
        const cells: HTMLElement[] = [];
        const texts: Text[] = [];
        for (let k = 0; k < spot.cells.length; k++) {
          const cell = doc.createElement('span');
          cell.className = 'blinken-text-cell';
          const text = doc.createTextNode('');
          cell.append(text);
          group.append(cell);
          cells.push(cell);
          texts.push(text);
        }
        layer.append(group);
        return { spot, group, texts, cells, at: '' };
      });
    },
    write(i, chars) {
      const r = readouts[i];
      if (!r) return;
      for (const [k, t] of r.texts.entries()) {
        const next = chars[k] ?? '';
        if (t.data !== next) t.data = next;
      }
    },
    place(fits) {
      if (!fixed) {
        const box = `${canvas.offsetLeft} ${canvas.offsetTop} ${canvas.offsetWidth} ${canvas.offsetHeight}`;
        if (box !== layer.dataset.box) {
          layer.dataset.box = box;
          Object.assign(layer.style, {
            left: `${canvas.offsetLeft}px`,
            top: `${canvas.offsetTop}px`,
            width: `${canvas.offsetWidth}px`,
            height: `${canvas.offsetHeight}px`,
          });
        }
      }
      const w = layer.clientWidth;
      const h = layer.clientHeight;
      for (const [i, r] of readouts.entries()) {
        if (!r) continue;
        const f = fits[i] ?? null;
        const at = f ? JSON.stringify([f, w, h]) : '';
        if (at === r.at) continue;
        r.at = at;
        r.group.hidden = !f;
        if (!f) continue;
        const c = f.clip;
        r.group.style.clipPath = `inset(${c.y0}px ${w - c.x1}px ${h - c.y1}px ${c.x0}px)`;
        const skew = `skewX(${-Math.atan(f.slant)}rad)`;
        for (const [k, cell] of r.cells.entries()) {
          const b = r.spot.cells[k];
          if (!b) continue;
          const tall = b.height * f.scale;
          Object.assign(cell.style, {
            left: `${f.left + (b.x - b.y * f.slant) * f.scale}px`,
            top: `${f.top + b.y * f.scale}px`,
            width: `${b.width * f.scale}px`,
            height: `${tall}px`,
            fontSize: `${tall * 0.8}px`,
            lineHeight: `${tall}px`,
            transform: f.slant ? skew : '',
          });
        }
      }
    },
    destroy() {
      layer.remove();
    },
  };
}
