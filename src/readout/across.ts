/**
 * What a document's readouts share across text layers: the selection a drag carries from readout
 * to readout, in reading order on the page, and the press it started from. The page's selection
 * holds one range, which would take in whatever lies between two readouts in the document, so a
 * selection over several is kept here and only the readout it started in holds the page's range.
 */

/** A readout a drag can reach: its group, its cells' characters, and the cell nearest a point. */
export interface Reach {
  group: HTMLElement;
  texts: Text[];
  cellAt(x: number, y: number): number;
}

/** Where a press's selection started or reached: cell `k` of readout `r`. */
export interface Anchor {
  readonly r: Reach;
  readonly k: number;
}

interface Stretch {
  readonly from: Anchor;
  /** Null for a press that hasn't selected anything yet. */
  to: Anchor | null;
  /** First to last cell picked of each readout it takes in. */
  picks: Map<Reach, readonly [number, number]>;
}

interface Shared {
  readonly reaches: Set<Reach>;
  stretch: Stretch | null;
  readonly heard: Set<() => void>;
}

const shared = new WeakMap<Document, Shared>();
const byGroup = new WeakMap<Element, Reach>();

/**
 * Sorts `items` as a page reads: rows top to bottom, left to right within a row, two boxes sharing
 * a row where their middles are within half the shorter's height. Items with no box are left out.
 */
export function readingOrder<T>(items: readonly T[], boxOf: (t: T) => DOMRect | null): T[] {
  const boxed = items.flatMap((t) => {
    const b = boxOf(t);
    return b ? [{ t, b }] : [];
  });
  boxed.sort(({ b: p }, { b: q }) => {
    const row = Math.min(p.height, q.height) / 2;
    const dy = p.top + p.height / 2 - (q.top + q.height / 2);
    return Math.abs(dy) <= row ? p.left - q.left : dy;
  });
  return boxed.map(({ t }) => t);
}

/** A readout's box, or null while it isn't shown. */
export const boxOf = (r: Reach): DOMRect | null =>
  r.group.hidden || !r.group.isConnected ? null : r.group.getBoundingClientRect();

const notify = (s: Shared) => {
  for (const fn of s.heard) fn();
};

/** Whether the page's selection is the range the stretch keeps, in its first readout. */
function holds(doc: Document, st: Stretch): boolean {
  const sel = doc.getSelection();
  if (!st.to) return !sel || sel.isCollapsed;
  const g = st.from.r.group;
  return !!sel && !sel.isCollapsed && g.contains(sel.anchorNode) && g.contains(sel.focusNode);
}

function sharedOf(doc: Document): Shared {
  let s = shared.get(doc);
  if (s) return s;
  const mine: Shared = { reaches: new Set(), stretch: null, heard: new Set() };
  s = mine;
  shared.set(doc, mine);
  // A selection made anywhere else, or a press outside every readout, ends the stretch.
  doc.addEventListener('selectionchange', () => {
    if (mine.stretch && !holds(doc, mine.stretch)) drop(doc);
  });
  doc.addEventListener(
    'mousedown',
    (e) => {
      if (e.button !== 0 || e.shiftKey) return;
      const el = e.target instanceof Element ? e.target.closest('.blinken-text-readout') : null;
      if (el && byGroup.has(el)) return;
      const sel = doc.getSelection();
      if (sel?.anchorNode?.parentElement?.closest('.blinken-text-readout')) sel.removeAllRanges();
      drop(doc);
    },
    true,
  );
  return mine;
}

/** Lets a drag from any readout on the page reach `r`, telling `heard` when the stretch changes. */
export function reachable(doc: Document, r: Reach, heard: () => void): void {
  const s = sharedOf(doc);
  s.reaches.add(r);
  byGroup.set(r.group, r);
  s.heard.add(heard);
}

/** Points `r`'s group, after a rebuild gave it a new one, back at `r`. */
export function regroup(r: Reach): void {
  byGroup.set(r.group, r);
}

/** Takes readouts `gone` off the page, ending a stretch that starts or ends in one. */
export function forget(doc: Document, gone: readonly Reach[], heard?: () => void): void {
  const s = sharedOf(doc);
  for (const r of gone) s.reaches.delete(r);
  if (heard) s.heard.delete(heard);
  const st = s.stretch;
  if (!st) return;
  if (gone.includes(st.from.r) || (st.to && gone.includes(st.to.r))) drop(doc);
  else if (gone.some((r) => st.picks.has(r))) {
    st.picks = picksOf(s, st);
    notify(s);
  }
}

/** The reach whose readout is under (`x`, `y`), in client pixels. */
export function reachAt(doc: Document, x: number, y: number): Reach | null {
  const el = doc.elementFromPoint(x, y)?.closest('.blinken-text-readout');
  return (el && byGroup.get(el)) ?? null;
}

/** Where the last press in a readout started, for a drag or a Shift+click. */
export const anchorOf = (doc: Document): Anchor | null => shared.get(doc)?.stretch?.from ?? null;

/** First to last cell of `r` the stretch picks, if it takes `r` in. */
export const pickOf = (doc: Document, r: Reach): readonly [number, number] | null =>
  shared.get(doc)?.stretch?.picks.get(r) ?? null;

/** Whether a selection made by pressing in readouts is held. */
export const stretched = (doc: Document): boolean => !!shared.get(doc)?.stretch?.to;

function picksOf(s: Shared, st: Stretch): Map<Reach, readonly [number, number]> {
  const picks = new Map<Reach, readonly [number, number]>();
  const { from, to } = st;
  if (!to) return picks;
  const last = (r: Reach) => r.texts.length - 1;
  if (from.r === to.r) {
    picks.set(from.r, [Math.min(from.k, to.k), Math.max(from.k, to.k)]);
    return picks;
  }
  const order = readingOrder([...s.reaches], boxOf);
  const i = order.indexOf(from.r);
  const j = order.indexOf(to.r);
  if (i < 0 || j < 0) return picks;
  const [lo, hi] = i < j ? [from, to] : [to, from];
  const [a, b] = i < j ? [i, j] : [j, i];
  picks.set(lo.r, [lo.k, last(lo.r)]);
  for (const r of order.slice(a + 1, b)) if (r.texts.length > 0) picks.set(r, [0, last(r)]);
  picks.set(hi.r, [0, hi.k]);
  return picks;
}

/** Puts the stretch's first readout's part on the page's selection, as copy and reading need. */
function show(doc: Document, st: Stretch): void {
  const sel = doc.getSelection();
  const part = st.picks.get(st.from.r);
  const lo = part && st.from.r.texts[part[0]];
  const hi = part && st.from.r.texts[part[1]];
  if (!sel || !lo || !hi) return;
  const range = doc.createRange();
  range.setStart(lo, 0);
  range.setEnd(hi, hi.length);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** A press at `at` starts a new stretch there, selecting nothing yet. */
export function press(doc: Document, at: Anchor): void {
  const s = sharedOf(doc);
  s.stretch = { from: at, to: null, picks: new Map() };
  doc.getSelection()?.removeAllRanges();
  notify(s);
}

/** Selects from the stretch's start, or from `from` where given, to cell `k` of `r`. */
export function extend(doc: Document, r: Reach, k: number, from?: Anchor): void {
  const s = sharedOf(doc);
  if (from) s.stretch = { from, to: null, picks: new Map() };
  const st = s.stretch;
  if (!st) return;
  st.to = { r, k };
  st.picks = picksOf(s, st);
  show(doc, st);
  notify(s);
}

/** Puts the stretch back on the page's selection, after `r`'s characters were replaced. */
export function refresh(doc: Document, r: Reach): void {
  const st = shared.get(doc)?.stretch;
  if (st?.to && st.from.r === r) show(doc, st);
}

/** Ends the stretch, the press it started from included. */
export function drop(doc: Document): void {
  const s = shared.get(doc);
  if (!s?.stretch) return;
  s.stretch = null;
  notify(s);
}
