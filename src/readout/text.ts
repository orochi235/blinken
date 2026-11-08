import {
  boxOf,
  forget,
  pickOf,
  type Reach,
  reachable,
  refresh,
  regroup,
  stretched,
} from './across.js';
import { type CopiedLine, copying } from './copy.js';
import type { Spot } from './layout.js';
import type { Fit } from './placement.js';
import { cellAt, type One, type Picked, type Pressing } from './text-cells.js';
import { placeAll } from './text-place.js';
import { all, pressRead } from './text-press.js';
import { addField, type FieldOptions, pressTyped, typedPick } from './text-typed.js';

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
.blinken-text-block .blinken-text-on { background: color-mix(in srgb, Highlight 45%, transparent); }
.blinken-text-input {
  position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0;
  opacity: 0; pointer-events: none; user-select: text; -webkit-user-select: text;
}
.blinken-text-readout:focus { outline: none; }

`;
const styled = new WeakSet<Document>();

function style(doc: Document): void {
  if (styled.has(doc)) return;
  styled.add(doc);
  const sheet = doc.createElement('style');
  sheet.textContent = STYLE;
  doc.head.append(sheet);
}

/** A readout's characters as its value spells them, for `write`. */
export interface Spelled {
  /** Its value as typed. */
  readonly value: string;
  /** The value as it copies, a character for each of the value's. */
  readonly copied: string;
  /** Each character's cell, or -1 where it shows nowhere. */
  readonly places: readonly number[];
  /** For each caret place, the cell a caret there stands at. */
  readonly carets: readonly (number | null)[];
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
   * `key` is what the readout is known by across rebuilds, so what was picked in it comes back. An
   * editable one also gets a hidden field that takes the keyboard.
   */
  build(
    readouts: readonly (
      | (FieldOptions & {
          key: unknown;
          spot: Spot;
          block: boolean;
          edit: boolean;
        })
      | null
    )[],
  ): void;
  /** Sets readout `i`'s cells' characters, a cell's '' for a blank, and how its value spells. */
  write(i: number, cells: readonly string[], spelled: Spelled): void;
  /** Sets attributes on editable readout `i`'s field. */
  field(i: number, attributes: Readonly<Record<string, string>>): void;
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

/** Follows the pointer on `doc` with `move` until the button comes up, giving what stops it early. */
function track(doc: Document, move: (m: MouseEvent) => void, done: () => void): () => void {
  const up = () => {
    doc.removeEventListener('mousemove', move);
    doc.removeEventListener('mouseup', up);
    done();
  };
  doc.addEventListener('mousemove', move);
  doc.addEventListener('mouseup', up);
  return up;
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
  let readouts: (One | null)[] = [];
  const reaches = () => readouts.flatMap((r) => (r && !r.input ? [r.reach] : []));
  /** A focused field's caret or selection, put back once its rebuilt readout has its value again. */
  let restore: {
    key: unknown;
    start: number;
    end: number;
    dir: 'forward' | 'backward' | 'none';
  } | null = null;
  let rebuilding = false;
  let shown = '';
  const typing = () => readouts.find((r) => r?.input && doc.activeElement === r.input) ?? null;
  const report = () => {
    const sel = doc.getSelection();
    const ranges =
      sel && !sel.isCollapsed
        ? Array.from({ length: sel.rangeCount }, (_, k) => sel.getRangeAt(k))
        : [];
    const own = stretched(doc);
    // A focused field picks in its readout; otherwise a selection made by pressing in readouts
    // does, or the page's selection, so a select-all takes them in too.
    const now = readouts.map((r): Picked | null => {
      if (!r) return null;
      if (r.input && doc.activeElement === r.input) return typedPick(r, r.input);
      const p = own ? pickOf(doc, r.reach) : null;
      return {
        cells: r.texts.map((t, k) =>
          own ? !!p && k >= p[0] && k <= p[1] : ranges.some((range) => covers(range, t)),
        ),
        caret: null,
      };
    });
    const key = JSON.stringify(now);
    if (key === shown) return;
    shown = key;
    for (const [i, r] of readouts.entries())
      if (r?.block)
        for (const [k, cell] of r.cells.entries())
          cell.classList.toggle('blinken-text-on', now[i]?.cells[k] ?? false);
    selected(now);
  };
  doc.addEventListener('selectionchange', report);

  let ending: (() => void) | null = null;
  const pressing: Pressing = {
    doc,
    report,
    drag(move) {
      ending?.();
      ending = track(doc, move, () => {
        ending = null;
      });
    },
    find: (key) => readouts.find((r) => r?.key === key) ?? null,
  };

  /** Cmd or Ctrl+A in a readout selects all of it, rather than leaving it to the page. */
  const selectAll = (r: One) => (k: KeyboardEvent) => {
    if (k.defaultPrevented) return;
    if (k.key.toLowerCase() !== 'a' || !(k.metaKey || k.ctrlKey) || k.altKey || k.shiftKey) return;
    k.preventDefault();
    if (r.input) r.input.select();
    else all(pressing, r);
    report();
  };
  const press = (r: One) => (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (r.input) pressTyped(pressing, r, r.input, e);
    else pressRead(pressing, r, e);
  };

  /** What this layer copies: each readout's selected cells, row by row. */
  const copied = (): CopiedLine[] | null => {
    const t = typing();
    if (t?.input) {
      // A focused field copies its selection, in the case its readout copies in.
      const s = t.input.selectionStart ?? 0;
      const e = t.input.selectionEnd ?? s;
      return e > s ? [{ box: boxOf(t.reach), text: t.copied.slice(s, e) }] : null;
    }
    const picks: (Picked | null)[] = shown ? JSON.parse(shown) : [];
    const lines: CopiedLine[] = [];
    for (const [i, r] of readouts.entries()) {
      const cells = picks[i]?.cells;
      if (!r || !cells?.some(Boolean)) continue;
      const rows: string[] = [];
      for (const [k, on] of cells.entries()) {
        const row = Math.floor(k / r.spot.perLine);
        rows[row] = (rows[row] ?? '') + (on ? (r.texts[k]?.data ?? '') : '');
      }
      lines.push({ box: boxOf(r.reach), text: rows.filter((row) => row !== '').join('\n') });
    }
    return lines;
  };
  const uncopy = copying(doc, copied);

  return {
    build(list) {
      // A rebuild replaces every box, so what was typed at comes back with the value; a readout
      // keeps its reach, so a selection over it, and a drag running into it, carry on.
      const t = typing();
      restore = t?.input
        ? {
            key: t.key,
            start: t.input.selectionStart ?? 0,
            end: t.input.selectionEnd ?? 0,
            dir: t.input.selectionDirection ?? 'none',
          }
        : null;
      const kept = new Map(readouts.flatMap((r) => (r ? [[r.key, r.reach] as const] : [])));
      const was = reaches();
      rebuilding = true;
      layer.replaceChildren();
      rebuilding = false;
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
          // An editable one's field is what a screen reader reads; its cells would read it twice.
          if (one.edit) cell.setAttribute('aria-hidden', 'true');
          const text = doc.createTextNode('');
          cell.append(text);
          group.append(cell);
          cells.push(cell);
          texts.push(text);
        }
        layer.append(group);
        const reach: Reach = kept.get(one.key) ?? { group, texts, cellAt: () => 0 };
        const made: One = {
          key: one.key,
          spot,
          group,
          texts,
          cells,
          block: one.block,
          at: '',
          input: null,
          places: [],
          carets: [],
          copied: '',
          reach,
        };
        Object.assign(reach, {
          group,
          texts,
          cellAt: (x: number, y: number) => cellAt(made, x, y),
        });
        if (one.edit)
          made.input = addField(
            pressing,
            made,
            one,
            (value) => edited(readouts.indexOf(made), value),
            () => rebuilding,
          );
        else if (one.label) {
          group.setAttribute('role', 'group');
          group.setAttribute('aria-label', one.label);
        }
        group.addEventListener('mousedown', press(made));
        group.addEventListener('keydown', selectAll(made));
        if (!one.edit) {
          group.tabIndex = -1;
          reachable(doc, reach, report);
          regroup(reach);
        }
        return made;
      });
      const now = new Set(reaches());
      forget(
        doc,
        was.filter((r) => !now.has(r)),
      );
      shown = '';
      report();
    },
    field(i, attributes) {
      const input = readouts[i]?.input;
      if (input) for (const [name, v] of Object.entries(attributes)) input.setAttribute(name, v);
    },
    write(i, chars, spelled) {
      const r = readouts[i];
      if (!r) return;
      r.places = spelled.places;
      r.copied = spelled.copied;
      r.carets = spelled.carets;
      if (r.input && r.input.value !== spelled.value) r.input.value = spelled.value;
      let changed = false;
      for (const [k, t] of r.texts.entries()) {
        const next = chars[k] ?? '';
        if (t.data === next) continue;
        t.data = next;
        changed = true;
      }
      // New characters collapse a range over the old ones.
      if (changed) refresh(doc, r.reach);
      const back = restore;
      if (back && back.key === r.key && r.input) {
        restore = null;
        r.input.focus();
        r.input.setSelectionRange(back.start, back.end, back.dir);
      }
      report();
    },
    place(fits) {
      placeAll(layer, fixed ? null : canvas, readouts, fits);
    },
    destroy() {
      ending?.();
      doc.removeEventListener('selectionchange', report);
      forget(doc, reaches(), report);
      uncopy();
      layer.remove();
    },
  };
}
