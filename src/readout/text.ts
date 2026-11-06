import type { Spot } from './layout.js';
import type { Fit } from './placement.js';

const STYLE = `
.blinken-text { position: absolute; pointer-events: none; overflow: hidden; }
.blinken-text-fixed { position: fixed; inset: 0; }
.blinken-text-readout { position: absolute; pointer-events: auto; cursor: text; user-select: none; -webkit-user-select: none; }
.blinken-text-cell {
  position: absolute; box-sizing: border-box; margin: 0; padding: 0;
  pointer-events: none; user-select: text; -webkit-user-select: text;
  color: transparent; background: transparent; white-space: pre; overflow: hidden;
  font-family: ui-monospace, monospace; text-align: center; transform-origin: 0 0;
}
.blinken-text-cell::selection { color: transparent; background: transparent; }
.blinken-text-block .blinken-text-cell::selection { background: color-mix(in srgb, Highlight 45%, transparent); }
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
 * the page's own selection, copy and screen readers reach them. A readout of a type that selects
 * by inverting has the surface invert its selected cells' lights; for any other the browser draws
 * the selection as a block over each cell.
 */
export interface TextLayer {
  /** Makes boxes for each readout's cells, by readout order; `null` for one that can't be selected. */
  build(readouts: readonly ({ spot: Spot; block: boolean } | null)[]): void;
  /** Sets readout `i`'s cells' characters, a cell's '' for a blank. */
  write(i: number, cells: readonly string[]): void;
  /** Moves every box to where its readout is drawn now. */
  place(fits: readonly (Fit | null)[]): void;
  destroy(): void;
}

/** Whether `range` takes in some of `node`'s characters, not only a boundary at one of its ends. */
function covers(range: Range, node: Text): boolean {
  if (node.length === 0 || !range.intersectsNode(node)) return false;
  if (range.startContainer === node && range.startOffset >= node.length) return false;
  if (range.endContainer === node && range.endOffset === 0) return false;
  return true;
}

/**
 * A text layer beside `canvas`: over its box, or fixed over the viewport for an overlay's. Tells
 * `selected` which cells of each readout the page's selection takes in whenever that changes.
 */
export function createTextLayer(
  canvas: HTMLCanvasElement,
  fixed: boolean,
  selected: (cells: readonly (readonly boolean[] | null)[]) => void,
): TextLayer {
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
  let shown = '';
  const report = () => {
    const sel = doc.getSelection();
    const ranges =
      sel && !sel.isCollapsed
        ? Array.from({ length: sel.rangeCount }, (_, k) => sel.getRangeAt(k))
        : [];
    const now = readouts.map((r) =>
      r ? r.texts.map((t) => ranges.some((range) => covers(range, t))) : null,
    );
    const key = JSON.stringify(now);
    if (key === shown) return;
    shown = key;
    selected(now);
  };
  doc.addEventListener('selectionchange', report);

  type One = NonNullable<(typeof readouts)[number]>;
  /** Selects cells `a` to `b` of `r`, either order, as the page's selection. */
  const choose = (r: One, a: number, b: number) => {
    const lo = r.texts[Math.min(a, b)];
    const hi = r.texts[Math.max(a, b)];
    const sel = doc.getSelection();
    if (!lo || !hi || !sel) return;
    const range = doc.createRange();
    range.setStart(lo, 0);
    range.setEnd(hi, hi.length);
    sel.removeAllRanges();
    sel.addRange(range);
  };
  /** The cell of `r` nearest `x` across, in client pixels. */
  const cellAt = (r: One, x: number): number => {
    let best = 0;
    let gap = Number.POSITIVE_INFINITY;
    for (const [k, cell] of r.cells.entries()) {
      const b = cell.getBoundingClientRect();
      const d = Math.abs(x - (b.left + b.right) / 2);
      if (d < gap) {
        gap = d;
        best = k;
      }
    }
    return best;
  };
  /** Where the last press's selection started: its readout and cell, for a drag or a Shift+click. */
  let anchor: { r: One; k: number } | null = null;
  const blank = (t: Text | undefined) => !t || t.data.trim() === '';
  // The browser selects nothing reliably across separately placed cells, so a press is read here,
  // a whole cell at a time: drag, double-click for a run between blanks, triple-click for it all.
  const press = (r: One) => (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const k = cellAt(r, e.clientX);
    if (e.detail >= 3) {
      choose(r, 0, r.cells.length - 1);
      return;
    }
    if (e.detail === 2) {
      if (blank(r.texts[k])) return;
      let a = k;
      let b = k;
      while (a > 0 && !blank(r.texts[a - 1])) a--;
      while (b < r.texts.length - 1 && !blank(r.texts[b + 1])) b++;
      choose(r, a, b);
      return;
    }
    if (e.shiftKey && anchor?.r === r) choose(r, anchor.k, k);
    else {
      anchor = { r, k };
      doc.getSelection()?.removeAllRanges();
    }
    const from = { r, k: anchor?.r === r ? anchor.k : k };
    const x0 = e.clientX;
    const move = (m: MouseEvent) => {
      if (Math.abs(m.clientX - x0) < 3 && cellAt(r, m.clientX) === from.k) return;
      choose(r, from.k, cellAt(r, m.clientX));
    };
    const up = () => {
      doc.removeEventListener('mousemove', move);
      doc.removeEventListener('mouseup', up);
    };
    doc.addEventListener('mousemove', move);
    doc.addEventListener('mouseup', up);
  };

  // A press on the canvas, or anywhere else that isn't text, leaves the page's selection as it was,
  // so one outside every readout clears a selection held in this layer.
  const outside = (e: MouseEvent) => {
    if (e.button !== 0 || e.shiftKey) return;
    if (e.target instanceof Node && layer.contains(e.target)) return;
    const sel = doc.getSelection();
    if (sel?.anchorNode && layer.contains(sel.anchorNode)) sel.removeAllRanges();
  };
  doc.addEventListener('mousedown', outside, true);

  return {
    build(list) {
      layer.replaceChildren();
      readouts = list.map((one) => {
        if (!one) return null;
        const { spot } = one;
        const group = doc.createElement('div');
        group.className = one.block
          ? 'blinken-text-readout blinken-text-block'
          : 'blinken-text-readout';
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
        const made = { spot, group, texts, cells, at: '' };
        group.addEventListener('mousedown', press(made));
        return made;
      });
      anchor = null;
      shown = '';
      report();
    },
    write(i, chars) {
      const r = readouts[i];
      if (!r) return;
      for (const [k, t] of r.texts.entries()) {
        const next = chars[k] ?? '';
        if (t.data !== next) t.data = next;
      }
      report();
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
        // The group covers the readout's whole box and takes the pointer, so a drag ending between
        // its cells lands in them rather than in whatever text the page has elsewhere.
        const { width, height } = r.spot;
        const gx = f.left - height * f.slant * f.scale;
        const gy = f.top;
        const gw = (width + height * f.slant) * f.scale;
        const gh = height * f.scale;
        const c = f.clip;
        Object.assign(r.group.style, {
          left: `${gx}px`,
          top: `${gy}px`,
          width: `${gw}px`,
          height: `${gh}px`,
          clipPath: `inset(${c.y0 - gy}px ${gx + gw - c.x1}px ${gy + gh - c.y1}px ${c.x0 - gx}px)`,
        });
        const skew = `skewX(${-Math.atan(f.slant)}rad)`;
        for (const [k, cell] of r.cells.entries()) {
          const b = r.spot.cells[k];
          if (!b) continue;
          const tall = b.height * f.scale;
          Object.assign(cell.style, {
            left: `${f.left - gx + (b.x - b.y * f.slant) * f.scale}px`,
            top: `${b.y * f.scale}px`,
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
      doc.removeEventListener('selectionchange', report);
      doc.removeEventListener('mousedown', outside, true);
      layer.remove();
    },
  };
}
