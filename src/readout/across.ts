/**
 * What a document's readouts share across text layers: one selection a drag carries from readout
 * to readout, as it does across runs of text, the press it started from, and the copy that writes
 * them.
 */

/** A readout a drag can reach: its cells' characters, and the cell nearest a point. */
export interface Reach {
  readonly texts: readonly Text[];
  cellAt(x: number, y: number): number;
}

const reaches = new WeakMap<Element, Reach>();

/** Lets a drag from any readout on the page reach the one `group` draws. */
export function reachable(group: Element, reach: Reach): void {
  reaches.set(group, reach);
}

/** The readout under (`x`, `y`), in client pixels, if a drag can reach it. */
export function reachAt(doc: Document, x: number, y: number): Reach | null {
  const el = doc.elementFromPoint(x, y)?.closest('.blinken-text-readout');
  return (el && reaches.get(el)) ?? null;
}

/** Where the last press's selection started, for a drag or a Shift+click. */
export interface Anchor {
  readonly r: Reach;
  readonly k: number;
}
const anchors = new WeakMap<Document, Anchor>();

export const anchorOf = (doc: Document): Anchor | null => anchors.get(doc) ?? null;

export function anchor(doc: Document, at: Anchor | null): void {
  if (at) anchors.set(doc, at);
  else anchors.delete(doc);
}

/** Forgets the anchor if it's in one of `gone`, readouts a rebuild replaced. */
export function forget(doc: Document, gone: readonly Reach[]): void {
  const at = anchors.get(doc);
  if (at && gone.includes(at.r)) anchors.delete(doc);
}

/**
 * Selects cell `a` of `from` through cell `b` of `to` as the page's selection: one range, in
 * document order, taking in every readout between, as a drag across text does.
 */
export function span(doc: Document, from: Reach, a: number, to: Reach, b: number): void {
  let lo = from.texts[a];
  let hi = to.texts[b];
  const sel = doc.getSelection();
  if (!lo || !hi || !sel) return;
  if (from === to ? b < a : hi.compareDocumentPosition(lo) & Node.DOCUMENT_POSITION_FOLLOWING)
    [lo, hi] = [hi, lo];
  const range = doc.createRange();
  range.setStart(lo, 0);
  range.setEnd(hi, hi.length);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** A layer as a copy sees it: a line per readout with something selected. */
export interface Copier {
  /** The layer's element, which orders its lines among other layers'. */
  readonly at: Element;
  /** Null leaves the copy to the browser, as a focused field does. */
  lines(): string[] | null;
}
const copiers = new WeakMap<Document, Set<Copier>>();

/**
 * Adds a layer to what a copy on `doc` writes, giving what takes it off. Placed boxes copy as one
 * run with no line breaks, so where the selection holds nothing but readouts' characters, one
 * listener per document writes every layer's, a line each, in document order; one holding other
 * text is left to the browser.
 */
export function copying(doc: Document, me: Copier): () => void {
  let all = copiers.get(doc);
  if (!all) {
    const mine = new Set<Copier>();
    all = mine;
    copiers.set(doc, mine);
    const bare = (t: string) => t.replace(/\s+/g, '').toLowerCase();
    doc.addEventListener('copy', (e) => {
      const ordered = [...mine].sort((p, q) =>
        p.at.compareDocumentPosition(q.at) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
      const got = ordered.map((c) => c.lines());
      if (got.includes(null) || !e.clipboardData) return;
      const text = got.flatMap((l) => l ?? []);
      if (text.length === 0) return;
      if (bare(doc.getSelection()?.toString() ?? '') !== bare(text.join(''))) return;
      e.clipboardData.setData('text/plain', text.join('\n'));
      e.preventDefault();
    });
  }
  all.add(me);
  return () => all.delete(me);
}
