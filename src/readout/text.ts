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
.blinken-text-input {
  position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0;
  opacity: 0; pointer-events: none;
}
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
  /**
   * Makes boxes for each readout's cells, by readout order; `null` for one that can't be selected.
   * An editable one also gets a hidden field that takes the keyboard.
   */
  build(readouts: readonly ({ spot: Spot; block: boolean; edit: boolean } | null)[]): void;
  /**
   * Sets readout `i`'s cells' characters, a cell's '' for a blank; an editable one's value as typed,
   * and where each of its characters shows, as its type's `places` gives.
   */
  write(
    i: number,
    cells: readonly string[],
    typed?: {
      value: string;
      places: readonly number[];
      carets: readonly (number | null)[];
    },
  ): void;
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

/** What of a readout is picked: the cells a selection takes in, and the cell a caret stands at. */
export interface Picked {
  readonly cells: readonly boolean[];
  readonly caret: number | null;
}

/**
 * A text layer beside `canvas`: over its box, or fixed over the viewport for an overlay's. Tells
 * `selected` what of each readout is picked whenever that changes, and `edited` each value typed
 * into an editable one, which gives false to refuse it.
 */
export function createTextLayer(
  canvas: HTMLCanvasElement,
  fixed: boolean,
  selected: (picked: readonly (Picked | null)[]) => void,
  edited: (i: number, value: string) => boolean,
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
    /** An editable one's field: a text area where it has more than one row. */
    input: HTMLInputElement | HTMLTextAreaElement | null;
    /** Each character's cell, or -1 where it shows nowhere. */
    places: readonly number[];
    /** For each caret place, the cell a caret there stands at. */
    carets: readonly (number | null)[];
  } | null)[] = [];
  /** A caret or selection to put back once a rebuilt readout has its value again. */
  let restore:
    | { i: number; start: number; end: number; dir: 'forward' | 'backward' | 'none' }
    | { i: number; a: number; b: number }
    | null = null;
  let shown = '';
  /** What of editable `r` its field's caret or selection picks, while it has the focus. */
  const typedPick = (r: One, input: HTMLInputElement | HTMLTextAreaElement): Picked => {
    const n = r.cells.length;
    const none = new Array<boolean>(n).fill(false);
    if (doc.activeElement !== input) return { cells: none, caret: null };
    const s = input.selectionStart ?? 0;
    const e = input.selectionEnd ?? s;
    if (e > s) {
      const cells = [...none];
      for (let k = s; k < e; k++) {
        const at = r.places[k] ?? -1;
        if (at >= 0) cells[at] = true;
      }
      return { cells, caret: null };
    }
    return { cells: none, caret: r.carets[s] ?? null };
  };
  const report = () => {
    const sel = doc.getSelection();
    const ranges =
      sel && !sel.isCollapsed
        ? Array.from({ length: sel.rangeCount }, (_, k) => sel.getRangeAt(k))
        : [];
    const now = readouts.map((r) =>
      r
        ? r.input
          ? typedPick(r, r.input)
          : { cells: r.texts.map((t) => ranges.some((range) => covers(range, t))), caret: null }
        : null,
    );
    const key = JSON.stringify(now);
    if (key === shown) return;
    shown = key;
    selected(now);
  };
  doc.addEventListener('selectionchange', report);

  type One = NonNullable<(typeof readouts)[number]>;
  /** Where in an editable readout's value a press on cell `k` puts the caret, `after` its middle or not. */
  const posAt = (r: One, k: number, after: boolean): number => {
    const ks = r.places.flatMap((p, i) => (p === k ? [i] : []));
    if (ks.length > 0) return after ? (ks.at(-1) as number) + 1 : (ks[0] as number);
    // A blank cell: the start of its row's characters if it's before them, else their end.
    const row = Math.floor(k / r.spot.perLine);
    const mine = r.places.flatMap((p, i) =>
      p >= 0 && Math.floor(p / r.spot.perLine) === row ? [i] : [],
    );
    if (mine.length > 0)
      return k < (r.places[mine[0] as number] as number)
        ? (mine[0] as number)
        : (mine.at(-1) as number) + 1;
    const at = r.carets.findIndex((c) => c !== null && Math.floor(c / r.spot.perLine) === row);
    return at >= 0 ? at : r.places.length;
  };
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
  /** The cell of `r` nearest (`x`, `y`), in client pixels: in the nearest row, the nearest across. */
  const cellAt = (r: One, x: number, y: number): number => {
    let best = 0;
    let gap = Number.POSITIVE_INFINITY;
    for (const [k, cell] of r.cells.entries()) {
      const b = cell.getBoundingClientRect();
      const off = Math.max(0, Math.abs(y - (b.top + b.bottom) / 2) - b.height / 2);
      const d = off * 1e4 + Math.abs(x - (b.left + b.right) / 2);
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
  /** A press on an editable readout: the same gestures, moving its field's caret or selection. */
  const pressTyped = (r: One, input: HTMLInputElement | HTMLTextAreaElement, e: MouseEvent) => {
    input.focus();
    const posOf = (m: MouseEvent) => {
      const k = cellAt(r, m.clientX, m.clientY);
      const b = r.cells[k]?.getBoundingClientRect();
      return posAt(r, k, b ? m.clientX > (b.left + b.right) / 2 : false);
    };
    const at = posOf(e);
    if (e.detail >= 3) {
      input.select();
      report();
      return;
    }
    if (e.detail === 2) {
      const v = input.value;
      const word = (i: number) => i >= 0 && i < v.length && v[i]?.trim() !== '';
      let a = Math.min(at, Math.max(0, v.length - 1));
      if (!word(a)) return;
      let b = a + 1;
      while (word(a - 1)) a--;
      while (word(b)) b++;
      input.setSelectionRange(a, b);
      report();
      return;
    }
    const from = e.shiftKey ? (input.selectionStart ?? at) : at;
    input.setSelectionRange(Math.min(from, at), Math.max(from, at));
    report();
    const move = (m: MouseEvent) => {
      const to = posOf(m);
      input.setSelectionRange(
        Math.min(from, to),
        Math.max(from, to),
        to < from ? 'backward' : 'forward',
      );
      report();
    };
    const up = () => {
      doc.removeEventListener('mousemove', move);
      doc.removeEventListener('mouseup', up);
    };
    doc.addEventListener('mousemove', move);
    doc.addEventListener('mouseup', up);
  };
  // A text area's own rows wrap where its hidden text does, not where the cells do, so the keys
  // that move by row move by the readout's rows here.
  const rowKey = (r: One, input: HTMLTextAreaElement, k: KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k.key) || k.metaKey || k.ctrlKey) return;
    const back = input.selectionDirection === 'backward';
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const at = back ? start : end;
    const cell = r.carets[at];
    if (cell === null || cell === undefined) return;
    k.preventDefault();
    const per = r.spot.perLine;
    const row = Math.floor(cell / per);
    const col = cell % per;
    const on = (want: number) =>
      r.carets.flatMap((c, p) => (c !== null && Math.floor(c / per) === want ? [p] : []));
    let to: number;
    if (k.key === 'Home') to = on(row)[0] ?? at;
    else if (k.key === 'End') to = on(row).at(-1) ?? at;
    else {
      const want = row + (k.key === 'ArrowUp' ? -1 : 1);
      const ps = on(want);
      if (ps.length === 0) to = k.key === 'ArrowUp' ? 0 : r.carets.length - 1;
      else
        to = ps.reduce((best, p) =>
          Math.abs(((r.carets[p] as number) % per) - col) <
          Math.abs(((r.carets[best] as number) % per) - col)
            ? p
            : best,
        );
    }
    const from = k.shiftKey ? (back ? end : start) : to;
    input.setSelectionRange(
      Math.min(from, to),
      Math.max(from, to),
      to < from ? 'backward' : 'forward',
    );
    report();
  };
  const press = (r: One) => (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (r.input) {
      pressTyped(r, r.input, e);
      return;
    }
    const k = cellAt(r, e.clientX, e.clientY);
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
      const to = cellAt(r, m.clientX, m.clientY);
      if (Math.abs(m.clientX - x0) < 3 && to === from.k) return;
      choose(r, from.k, to);
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
      // A rebuild replaces every box, so what was selected or typed at comes back with the value.
      const active = readouts.findIndex((r) => r?.input && doc.activeElement === r.input);
      const was = active >= 0 ? readouts[active]?.input : null;
      if (was)
        restore = {
          i: active,
          start: was.selectionStart ?? 0,
          end: was.selectionEnd ?? 0,
          dir: was.selectionDirection ?? 'none',
        };
      else {
        const picks: (Picked | null)[] = shown ? JSON.parse(shown) : [];
        const i = picks.findIndex((p) => p?.cells.some(Boolean));
        const cells = picks[i]?.cells ?? [];
        restore = i >= 0 ? { i, a: cells.indexOf(true), b: cells.lastIndexOf(true) } : null;
      }
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
        const made: One = {
          spot,
          group,
          texts,
          cells,
          at: '',
          input: null,
          places: [],
          carets: [],
        };
        if (one.edit) {
          const rows = spot.cells.length > spot.perLine;
          const input = rows ? doc.createElement('textarea') : doc.createElement('input');
          input.className = 'blinken-text-input';
          if (input instanceof HTMLInputElement) input.type = 'text';
          input.spellcheck = false;
          input.autocomplete = 'off';
          group.append(input);
          made.input = input;
          let last = '';
          input.addEventListener('focus', () => {
            last = input.value;
          });
          input.addEventListener('input', () => {
            const i = readouts.indexOf(made);
            if (edited(i, input.value)) last = input.value;
            else {
              const at = Math.max(0, (input.selectionStart ?? 1) - 1);
              input.value = last;
              input.setSelectionRange(at, at);
            }
            report();
          });
          if (input instanceof HTMLTextAreaElement)
            input.addEventListener('keydown', (k) => rowKey(made, input, k));
          for (const name of ['keyup', 'select', 'selectionchange', 'focus', 'blur'])
            input.addEventListener(name, report);
        }
        group.addEventListener('mousedown', press(made));
        return made;
      });
      anchor = null;
      shown = '';
      report();
    },
    write(i, chars, typed) {
      const r = readouts[i];
      if (!r) return;
      if (r.input) {
        if (typed) {
          r.places = typed.places;
          r.carets = typed.carets;
          if (r.input.value !== typed.value) r.input.value = typed.value;
        }
      } else
        for (const [k, t] of r.texts.entries()) {
          const next = chars[k] ?? '';
          if (t.data !== next) t.data = next;
        }
      if (restore?.i === i) {
        const back = restore;
        restore = null;
        if ('start' in back && r.input) {
          r.input.focus();
          r.input.setSelectionRange(back.start, back.end, back.dir);
        } else if ('a' in back && !r.input) choose(r, back.a, back.b);
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
