import { drop } from './across.js';
import { wordAt } from './flow.js';
import { cellAt, type One, type Picked, type Pressing } from './text-cells.js';

type Field = HTMLInputElement | HTMLTextAreaElement;

/** What of editable `r` its field's caret or selection picks, while it has the focus. */
export function typedPick(r: One, input: Field): Picked {
  const none = new Array<boolean>(r.cells.length).fill(false);
  if (input.ownerDocument.activeElement !== input) return { cells: none, caret: null };
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
}

/** Where in an editable readout's value a press on cell `k` puts the caret, `after` its middle or not. */
function posAt(r: One, k: number, after: boolean): number {
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
}

/** Selects `from` to `to` of `input`'s value, either order, the caret at `to`. */
const pick = (input: Field, from: number, to: number) =>
  input.setSelectionRange(
    Math.min(from, to),
    Math.max(from, to),
    to < from ? 'backward' : 'forward',
  );

/** A press on an editable readout: the read-only gestures, moving its field's caret or selection. */
export function pressTyped(c: Pressing, r: One, input: Field, e: MouseEvent): void {
  input.focus();
  const posOf = (one: One, m: MouseEvent) => {
    const k = cellAt(one, m.clientX, m.clientY);
    const b = one.cells[k]?.getBoundingClientRect();
    return posAt(one, k, b ? m.clientX > (b.left + b.right) / 2 : false);
  };
  if (e.detail >= 3) {
    input.select();
    c.report();
    return;
  }
  if (e.detail === 2) {
    // The character the cell shows, whichever half was pressed.
    const i = r.places.indexOf(cellAt(r, e.clientX, e.clientY));
    const w = i >= 0 ? wordAt([...input.value], i) : null;
    if (w) input.setSelectionRange(w[0], w[1]);
    c.report();
    return;
  }
  const at = posOf(r, e);
  const held = input.selectionDirection === 'backward' ? input.selectionEnd : input.selectionStart;
  const from = e.shiftKey ? (held ?? at) : at;
  pick(input, from, at);
  c.report();
  c.drag((m) => {
    const now = c.find(r.key);
    if (!now?.input) return;
    pick(now.input, from, posOf(now, m));
    c.report();
  });
}

// A text area's own rows wrap where its hidden text does, not where the cells do, so the keys
// that move by row move by the readout's rows here.
function rowKey(r: One, input: HTMLTextAreaElement, k: KeyboardEvent): boolean {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(k.key) || k.metaKey || k.ctrlKey)
    return false;
  const back = input.selectionDirection === 'backward';
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? start;
  const at = back ? start : end;
  const cell = r.carets[at];
  if (cell === null || cell === undefined) return false;
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
  pick(input, k.shiftKey ? (back ? end : start) : to, to);
  return true;
}

/** What an editable readout's field is given. */
export interface FieldOptions {
  readonly label?: string;
  readonly field?: Readonly<Record<string, string>>;
  readonly onKeyDown?: (e: KeyboardEvent) => void;
  readonly onBlur?: () => void;
}

/**
 * Gives `made` the hidden field that takes its keyboard. `edited` hears each value typed and gives
 * false to refuse it; `rebuilding` says the field is going because its layer is being rebuilt.
 */
export function addField(
  c: Pressing,
  made: One,
  one: FieldOptions,
  edited: (value: string) => boolean,
  rebuilding: () => boolean,
): Field {
  const { doc } = c;
  const rows = made.spot.cells.length > made.spot.perLine;
  const input = rows ? doc.createElement('textarea') : doc.createElement('input');
  input.className = 'blinken-text-input';
  if (input instanceof HTMLInputElement) input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  made.group.append(input);
  let last = '';
  input.addEventListener('focus', () => {
    last = input.value;
    // The field holds the selection now, so a stretch over readouts ends.
    drop(doc);
  });
  input.addEventListener('input', () => {
    if (edited(input.value)) last = input.value;
    else {
      const at = Math.max(0, (input.selectionStart ?? 1) - 1);
      input.value = last;
      input.setSelectionRange(at, at);
    }
    c.report();
  });
  for (const [name, v] of Object.entries(one.field ?? {})) input.setAttribute(name, v);
  // The page's own keys come first, and a key it takes is not the readout's.
  const onKey = one.onKeyDown;
  if (onKey) input.addEventListener('keydown', (k) => onKey(k as KeyboardEvent));
  const onBlur = one.onBlur;
  // A rebuild takes the field away and puts the focus back on its new one: no blur to the page.
  if (onBlur)
    input.addEventListener('blur', () => {
      if (!rebuilding() && input.isConnected) onBlur();
    });
  if (input instanceof HTMLTextAreaElement)
    input.addEventListener('keydown', (k) => {
      if (!k.defaultPrevented && rowKey(made, input, k)) c.report();
    });
  for (const name of ['keyup', 'select', 'selectionchange', 'focus', 'blur'])
    input.addEventListener(name, c.report);
  if (one.label) input.setAttribute('aria-label', one.label);
  return input;
}
