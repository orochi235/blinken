import { readingOrder, stretched } from './across.js';

/** A readout's selected characters as a copy writes them, and the box that orders it on the page. */
export interface CopiedLine {
  readonly box: DOMRect | null;
  readonly text: string;
}

/** A layer as a copy sees it: null leaves the copy to the browser, as a focused field does. */
export type Copier = () => CopiedLine[] | null;

const copiers = new WeakMap<Document, Set<Copier>>();

/**
 * Adds a layer to what a copy on `doc` writes, giving what takes it off. Placed boxes copy as one
 * run with no line breaks, so where the selection holds nothing but readouts' characters, one
 * listener per document writes every layer's readouts, a line each, in reading order on the page;
 * one holding other text is left to the browser.
 */
export function copying(doc: Document, me: Copier): () => void {
  let all = copiers.get(doc);
  if (!all) {
    const mine = new Set<Copier>();
    all = mine;
    copiers.set(doc, mine);
    const bare = (t: string) => t.replace(/\s+/g, '').toLowerCase();
    doc.addEventListener('copy', (e) => {
      const got = [...mine].map((c) => c());
      if (got.includes(null) || !e.clipboardData) return;
      const lines = readingOrder(
        got.flatMap((l) => l ?? []),
        (l) => l.box,
      ).map((l) => l.text);
      if (lines.length === 0) return;
      const own = stretched(doc);
      if (!own && bare(doc.getSelection()?.toString() ?? '') !== bare(lines.join(''))) return;
      e.clipboardData.setData('text/plain', lines.join('\n'));
      e.preventDefault();
    });
  }
  all.add(me);
  return () => all.delete(me);
}
