// Selecting, dragging, typing and copying in readouts' text layers, driven by the mouse events
// the layers read, on real layout and the page's real selection.
import type { Readout, ReadoutOptions, Surface } from '@/readout/api.js';
import { createOverlay } from '@/readout/overlay.js';
import { createPanel } from '@/readout/panel.js';
import { test } from './harness.js';
import { canvasIn, manual } from './page.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A page: a panel at the top, a paragraph of page text, and room for followed boxes below. */
function page() {
  document.body.replaceChildren();
  document.body.style.margin = '0';
  const ticker = manual();
  let now = 0;
  const step = () => {
    now += 16;
    ticker.step(now);
  };
  const canvas = canvasIn(600, 60);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const panel = createPanel(canvas, { backend: '2d', ticker });
  const text = document.createElement('p');
  text.textContent = 'between the readouts';
  document.body.append(text);
  const boxAt = (top: number) => {
    const el = document.createElement('div');
    Object.assign(el.style, { position: 'absolute', left: '10px', top: `${top}px` });
    Object.assign(el.style, { width: '200px', height: '40px' });
    document.body.append(el);
    return el;
  };
  const surfaces: Surface[] = [panel];
  const overlay = () => {
    const s = createOverlay({ backend: '2d', ticker });
    surfaces.push(s);
    return s;
  };
  const add = (s: Surface, o: Partial<ReadoutOptions> & { value: string }): Readout =>
    s.readout({ type: 'sixteen', cells: o.value.length, selection: 'block', ...o });
  const done = () => {
    for (const s of surfaces)
      try {
        s.destroy();
      } catch {}
    document.body.replaceChildren();
  };
  return { panel, overlay, add, step, boxAt, text, done };
}

/** The cells of the `n`th readout group on the page, in DOM order. */
const cellsOf = (n: number) => [
  ...(document
    .querySelectorAll('.blinken-text-readout')
    [n]?.querySelectorAll<HTMLElement>('.blinken-text-cell') ?? []),
];
/** The group whose cells show `value`. */
function readoutShowing(value: string): HTMLElement[] {
  for (const g of document.querySelectorAll('.blinken-text-readout')) {
    const cells = [...g.querySelectorAll<HTMLElement>('.blinken-text-cell')];
    if (cells.map((c) => c.textContent).join('') === value) return cells;
  }
  throw new Error(`no readout shows ${value}`);
}
/** A point in cell `c`, a share `across` of its width from its left. */
function at(c: HTMLElement | undefined, across = 0.3) {
  if (!c) throw new Error('no cell');
  const b = c.getBoundingClientRect();
  return { x: b.left + b.width * across, y: b.top + b.height / 2 };
}
function mouse(
  type: 'mousedown' | 'mousemove' | 'mouseup',
  p: { x: number; y: number },
  o: { detail?: number; shiftKey?: boolean } = {},
) {
  const target = type === 'mousedown' ? document.elementFromPoint(p.x, p.y) : document;
  target?.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: p.x,
      clientY: p.y,
      button: 0,
      detail: o.detail ?? 1,
      shiftKey: o.shiftKey ?? false,
    }),
  );
}
const click = (p: { x: number; y: number }, o: { detail?: number; shiftKey?: boolean } = {}) => {
  mouse('mousedown', p, o);
  mouse('mouseup', p, o);
};
function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  mouse('mousedown', from);
  mouse('mousemove', to);
  mouse('mouseup', to);
}
/** What a copy on the page writes, or '' where it leaves the copy to the browser. */
function copied(): string {
  const data = new DataTransfer();
  document.dispatchEvent(
    new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }),
  );
  return data.getData('text/plain');
}
/** Which of `cells` show as selected. */
const lit = (cells: HTMLElement[]) =>
  cells.map((c) => (c.classList.contains('blinken-text-on') ? 1 : 0)).join('');
function same(got: unknown, want: unknown, what: string) {
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
const field = () => document.activeElement as HTMLInputElement | HTMLTextAreaElement;

test('a drag from a panel readout to an overlay one selects them alone, in page order', async () => {
  const p = page();
  p.add(p.panel, { value: 'ABC', at: { x: 0, y: 0 }, height: 40 });
  const [low, high] = [p.boxAt(300), p.boxAt(150)];
  const o = p.overlay();
  // Made first, so first in the document, but lower on the page.
  p.add(o, { value: 'LOW', follow: low });
  p.add(o, { value: 'DEF', follow: high });
  for (let k = 0; k < 3; k++) p.step();
  drag(at(readoutShowing('ABC')[1]), at(readoutShowing('DEF')[1]));
  await tick();
  same(copied(), 'BC\nDE', 'copy');
  same(lit(readoutShowing('ABC')), '011', 'panel picks');
  same(lit(readoutShowing('DEF')), '110', 'followed picks');
  same(lit(readoutShowing('LOW')), '000', 'the readout made first');
  const sel = document.getSelection()?.toString() ?? '';
  if (sel.includes('between')) throw new Error(`the selection took in page text: ${sel}`);
  p.done();
});

test('copy writes readouts on one row left to right, whatever order they were made in', async () => {
  const p = page();
  p.add(p.panel, { value: 'RIGHT', at: { x: 300, y: 0 }, height: 40 });
  p.add(p.panel, { value: 'LEFT', at: { x: 0, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  drag(at(readoutShowing('LEFT')[0], 0.1), at(readoutShowing('RIGHT')[4], 0.9));
  await tick();
  same(copied(), 'LEFT\nRIGHT', 'copy');
  p.done();
});

test('a caret comes back in its own field after a readout before it goes', async () => {
  const p = page();
  const gone = p.add(p.panel, { value: 'GONE', at: { x: 0, y: 0 }, height: 40 });
  p.add(p.panel, { value: 'abc', edit: true, at: { x: 150, y: 0 }, height: 40 });
  p.add(p.panel, { value: 'xyz', edit: true, at: { x: 300, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  click(at(readoutShowing('ABC')[1], 0.9));
  same([field().value, field().selectionStart], ['abc', 2], 'caret before');
  gone.destroy();
  p.step();
  same([field().value, field().selectionStart], ['abc', 2], 'caret after');
  p.done();
});

test('a rebuild keeps a selection over several readouts, and a drag running carries on', async () => {
  const p = page();
  p.add(p.panel, { value: 'AB', at: { x: 0, y: 0 }, height: 40 });
  const two = p.add(p.panel, { value: 'CDEF', at: { x: 150, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  mouse('mousedown', at(readoutShowing('AB')[0], 0.1));
  mouse('mousemove', at(readoutShowing('CDEF')[1]));
  two.setSelection('block');
  p.step();
  await tick();
  same(copied(), 'AB\nCD', 'copy after a rebuild');
  mouse('mousemove', at(readoutShowing('CDEF')[3]));
  mouse('mouseup', at(readoutShowing('CDEF')[3]));
  await tick();
  same(copied(), 'AB\nCDEF', 'copy after the drag ran on');
  p.done();
});

test('a drag in a field carries on through a rebuild', async () => {
  const p = page();
  const other = p.add(p.panel, { value: 'X', at: { x: 300, y: 0 }, height: 40 });
  p.add(p.panel, { value: 'abcd', edit: true, at: { x: 0, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  mouse('mousedown', at(readoutShowing('ABCD')[0], 0.1));
  other.setSelection('block');
  p.step();
  mouse('mousemove', at(readoutShowing('ABCD')[2], 0.9));
  mouse('mouseup', at(readoutShowing('ABCD')[2], 0.9));
  same([field().value, field().selectionStart, field().selectionEnd], ['abcd', 0, 3], 'field');
  p.done();
});

test('a surface destroyed mid-drag stops following the pointer', async () => {
  const p = page();
  p.add(p.panel, { value: 'ABCD', at: { x: 0, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  const held = new Set<unknown>();
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  document.addEventListener = ((type: string, fn: EventListener, o?: unknown) => {
    if (type === 'mousemove') held.add(fn);
    add(type, fn, o as AddEventListenerOptions);
  }) as typeof document.addEventListener;
  document.removeEventListener = ((type: string, fn: EventListener, o?: unknown) => {
    if (type === 'mousemove') held.delete(fn);
    remove(type, fn, o as EventListenerOptions);
  }) as typeof document.removeEventListener;
  try {
    mouse('mousedown', at(readoutShowing('ABCD')[0], 0.1));
    same(held.size, 1, 'listening while the button is down');
    p.panel.destroy();
    same(held.size, 0, 'listening after the surface went');
  } finally {
    document.addEventListener = add;
    document.removeEventListener = remove;
  }
  p.done();
});

test('a double-click on a wrapped readout selects one word', async () => {
  const p = page();
  p.add(p.panel, { value: 'HELLO WORLD', cells: 5, lines: 2, at: { x: 0, y: 0 }, height: 50 });
  for (let k = 0; k < 3; k++) p.step();
  const cells = cellsOf(0);
  click(at(cells[1]), { detail: 1 });
  click(at(cells[1]), { detail: 2 });
  await tick();
  same(copied(), 'HELLO', 'copy');
  p.done();
});

test('a press outside every readout forgets the press a Shift+click extends from', async () => {
  const p = page();
  p.add(p.panel, { value: 'AB', at: { x: 0, y: 0 }, height: 40 });
  p.add(p.panel, { value: 'CD', at: { x: 150, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  click(at(readoutShowing('AB')[0]));
  const t = p.text.getBoundingClientRect();
  click({ x: t.left + 5, y: t.top + t.height / 2 });
  click(at(readoutShowing('CD')[1]), { shiftKey: true });
  await tick();
  same(copied(), '', 'copy');
  same(lit(readoutShowing('AB')), '00', 'first picks');
  p.done();
});

test('a double-click on either half of a character in a field selects its word', async () => {
  const p = page();
  p.add(p.panel, { value: 'ab cd', edit: true, at: { x: 0, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  const b = readoutShowing('AB CD')[1];
  click(at(b, 0.8), { detail: 1 });
  click(at(b, 0.8), { detail: 2 });
  same([field().selectionStart, field().selectionEnd], [0, 2], 'word');
  p.done();
});

test('Shift+click in a field extends a backward selection from its anchor', async () => {
  const p = page();
  p.add(p.panel, { value: 'abcdef', edit: true, at: { x: 0, y: 0 }, height: 40 });
  for (let k = 0; k < 3; k++) p.step();
  const cells = readoutShowing('ABCDEF');
  drag(at(cells[4], 0.1), at(cells[1], 0.1));
  same([field().selectionStart, field().selectionEnd], [1, 4], 'backward drag');
  click(at(cells[5], 0.9), { shiftKey: true });
  same([field().selectionStart, field().selectionEnd], [4, 6], 'extended');
  p.done();
});

test('a rebuild while typing keeps the focus and tells the page of no blur', async () => {
  const p = page();
  let blurs = 0;
  const other = p.add(p.panel, { value: 'X', at: { x: 300, y: 0 }, height: 40 });
  p.add(p.panel, {
    value: 'abc',
    edit: true,
    at: { x: 0, y: 0 },
    height: 40,
    onBlur: () => blurs++,
  });
  for (let k = 0; k < 3; k++) p.step();
  click(at(readoutShowing('ABC')[0], 0.1));
  other.setSelection('block');
  p.step();
  await tick();
  same([blurs, field().value], [0, 'abc'], 'blurs and focus');
  field().blur();
  same(blurs, 1, 'a real blur');
  p.done();
});
