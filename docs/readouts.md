# Segment readouts

How blinken draws segment displays: 7-segment digits, 14- and 16-segment alphanumerics, Nixie tubes,
and stranger notations that spell numbers or letters with bars and dots. For someone changing the
readout code or adding a display type. It assumes blinken's sign pipeline: the mix folds a `Pose` per
subject, the optics turn poses into what each light shows, and a backend (2D, WebGL 2, WebGPU)
draws the lights. Usage is in the README's "Readouts" section.

For now a readout is a plain readout: given a value, it shows it. Segments are built as blinken
lights so the effects stack can reach them, but nothing exposes effects on a readout yet
(2026-11-04).

## Display types

`TYPES` (`src/readout/types/`) holds 23. A type is data: one cell's lights, each a list of shapes
(disc, bar, or polyline) in the cell's units, and an encoder from a value to the lights each cell
lights.

| type                                     | takes          | notes                                                      |
| :--------------------------------------- | :------------- | :--------------------------------------------------------- |
| `seven`, `eight`, `nine`                 | text           | `.` and `:` after a character light that cell's dp, colon  |
| `half`                                   | `1`, `-`, `-1` | the ½ digit of a 3½-digit meter; `half: true` on a readout |
| `fourteen`, `sixteen`, `twentytwo`       | text           | `fourteen` has the pinball display's comma                 |
| `matrix`                                 | text           | blinken's own 5 × 7 standard face                          |
| `nixie`                                  | digits         | ten polyline cathodes, back to front 1 6 2 7 5 0 4 9 8 3   |
| `cistercian`                             | 0–9999 a cell  | four places in one glyph                                   |
| `maya`, `kaktovik`                       | numbers        | base 20, most significant cell first                       |
| `rods`                                   | numbers        | upright and lying places alternate                         |
| `braille`, `ogham`, `morse`, `semaphore` | text           | Grade 1, the 20 letters, International, the flag alphabet  |
| `dice`, `tally`, `bcd`                   | numbers        | nine pips; a gate of five a cell; four lamps a digit       |
| `bargraph`                               | 0 to 1         | one bar a cell                                             |
| `triangles`, `triangles-fine`            | text           | letters on the triangle grid: 5 × 7 doubled, or `strokes`  |

Numbers align right and keep their last cells when too long; text aligns left and keeps its first.
A character a type lacks shows blank. Every cell carries every light it can ever show, which is why
`rods` holds both its upright and lying sets.

## How it is drawn

**A segment is a light.** A surface lays every readout's lights out as the dots of one board
(`src/readout/layout.ts`): a band of rows per readout, one row per slot of its type's cell, and a
column per cell. Segment `slot` of cell `c` is the dot at `x = c`, `y = base + slot`. So the
optics, defects, ghosts, the GPU gather and the mix need no change, and an effect cued on a
readout's dots ranks its cells as columns. Board places a readout doesn't fill have no shapes and
draw nothing (2026-11-04).

**Every backend draws primitives** (`src/render/prims.ts`): discs, bars, polylines, triangles and faceplates,
each owned by a light and placed through a **view**, a per-readout transform of offset, scale,
slant and clip (`src/render/placement.ts`). The fragment shaders draw each from its signed
distance: a bar's ends are `point` (the 7-segment's hexagonal taper), `round` or `square`, and a
polyline's distance is its nearest segment's, read from a points buffer, so curves have no seams.
The marquee is one view of lamp-scaled discs through the same shaders. The TS `sdf` is the
reference for the WGSL and GLSL copies.

**Sockets.** An unlit light shows what its primitive's socket says: a dot's or bulb's dark socket,
a dark segment, a hairline of wire (Nixie), or nothing. A `face: 'plate'` readout gets a dark
faceplate behind its cells; `face: 'none'` gets no plate and no sockets, so only lit segments and
their glow sit over the page (2026-11-04).

**Bloom.** A marquee blurs its glow across the canvas at its one pitch. A surface's readouts differ
in size, so each primitive blooms by its own view's pitch instead: on the GPU the blur's spread is
folded into each primitive's Gaussian, and 2D casts each halo's shadow blurred that far. 2D and
the GPU agree within 19/255 at a segment's middle (`test/gpu/readouts.gpu.ts`).

**Values go through the mix.** One looping shader patch over the surface's dots
(`src/readout/voice.ts`) reads each dot's `lit` and `tint` from two tables, which `set` and
`color` rewrite; changes in a frame are cued once, at its start. On WebGPU `lit` stays on the GPU.

## Surfaces

A surface (`src/readout/surface.ts`) owns one canvas, one sign and one mix. Adding or removing a
readout lays the board out again at the next frame and reshapes the sign in place; values persist.

- **Panel** (`createPanel`): the canvas keeps the size the page gives it; each readout sits at an
  `at` and `height` in its CSS pixels.
- **Overlay** (`createOverlay`): one canvas fixed over the viewport, not taking the pointer. Each
  readout is fitted inside the element it `follow`s, aspect kept and centered, and clipped where
  that element's scrolling ancestors clip it. Rects are read every frame; a detached, hidden or
  scrolled-away element's readout gets scale 0 and its primitives are culled.

**Selectable text** (`src/readout/text.ts`). Beside the canvas sits a layer of see-through spans,
one per cell of each readout whose type has `text`, holding the characters that cell shows (the
tokenizer `textCoding` shares with its encoder, so a mark rides on its cell). Each frame they're
moved to the fit the placement used for the views (`fitOf`), skewed with the slant and clipped as
the readout is. The browser won't carry a drag across separately placed boxes, and finds a word or
a line inside one box only, so each readout's box reads the mouse itself, a cell at a time: drag,
double-click for the run between blanks, triple-click for the whole readout, Shift+click to extend.
Each sets a real range on the page's selection, which copying and `selectionchange` read.

An `edit: true` readout also holds a hidden `<input>` with its value, which takes the keyboard
(typing, arrows, copy and paste, undo). The same gestures move its caret and selection, through the
type's `places`, which says the cell each character lands in; the caret is the cell's underline,
blinking. Text that would run past the cells is refused; a number keeps its last cells.

How a selected cell shows is the readout's `selection`, else its type's: `invert` swaps its lights
through the sign's highlight (the default for `matrix` and the triangle types, as compose's size
readouts do); `glow` (every other type's default) pales its lit lights and lights its unlit ones
dimly, except where they overlap as a Nixie's cathodes do; `recolor` only pales them; `underline`
lights a bar the layout adds under each cell; `block` is the browser's own highlight. All but
`invert` and `block` go through the value voice, so they draw alike on every backend. Inverting a
segment cell lights every segment its character leaves dark; a lit faceplate with dark segments
would need lights that cover rather than add, which no backend has (2026-11-06).

**Ghosts** are a surface option: `row` leaks along a segment line (the same segment across a
readout's digits, as a multiplexed display leaks); `col` runs down a board column and so crosses
readouts. **Defects** are per readout, by `{ cell, slot }`.

Measured against a shared marquee sign, one panel of 7-segment readouts keeps pace: 2,065 fps at
1,000 digits against 1,791 (`docs/gpu-renderers.md`, "Many small displays").

## Not built

Kept in `TODO.md`: Nixie front wires darkening the lit numeral where they cross; effects on a
readout through a public option; whole marquees on a shared surface; the Numitron, flip-segment
and VFD materials; and custom LCD types cut from characters.
