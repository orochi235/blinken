# Segment readouts

**Status: designed 2026-11-04, unbuilt.** This is the design, not a description of the repo. Check
what has landed before quoting any of it as fact.

For whoever builds bree's segment displays. It assumes you know bree's sign pipeline: the mix
folds a `Pose` per subject, the optics (`src/optics.ts`, `src/render/webgpu/wgsl-optics.ts`) turn
poses into what each light shows, and three backends draw the lights (2D `src/draw.ts`, WebGL
`src/render/webgl/`, WebGPU `src/render/webgpu/`). It answers what a segment display is in bree,
how one gets drawn, and how many of them share a page.

## Intent

bree draws an LED marquee: a grid of round dots. This adds **readouts**: small displays that show
a value, made of segments rather than dots. Examples are the 7-segment digits of a clock or meter,
a 14-segment alphanumeric, a Nixie tube, and a set of stranger notations (Cistercian numerals,
Maya numerals, Ogham, semaphore) that spell numbers or letters with bars and dots.

For now a readout is a plain readout: you give it a value and it shows that value. Turning
segment displays into a full scrolling board may come later (2026-11-04). So a segment is built as
a bree light from the start, and the effects stack can reach it even though nothing exposes that
yet.

## Goals

- **Every display type is data.** A type is a set of segment shapes plus an encoder from a value
  to the segments it lights. A new type never touches renderer code.
- **A segment is a light, the same as a dot.** Each segment is a mix subject with the full `Pose`
  (`lit`, `gain`, `tint`, `hue`, `chroma`, `glow`, `invert`) and goes through the same optics:
  fade, ghosts, defects and bloom. Layers (sparkle, rainbow, flicker) and orders by column, row or
  from the center must work on segments when someone cues them, using each segment's midpoint as
  its place. This build cues none of them.
- **Many readouts share one sign and one canvas.** On WebGPU, 500 digit-sized signs on canvases of
  their own ran at 16 fps, and the same digits as one sign on one canvas ran at 3,452 fps
  (`docs/gpu-renderers.md`, "Many small displays", measured on teitou). Readouts must never take a
  canvas each.
- **All three backends.** WebGPU, WebGL 2 and 2D draw every type. On WebGPU, showing a value
  keeps `lit` on the GPU, the same way the marquee's moves do.

## Non-goals

- Exposing layers, effects or moves on a readout. The way in stays open; nothing is added to the
  API for it in this build.
- Scrolling text, transitions between values, or a program of scenes. A value change is instant,
  and the optics' fade softens it as it already does for dots.
- Moving the lab's thumbnails onto the shared surface. That needs whole marquees on one surface
  and is filed as a follow-up (see "After this").

## Anti-goals

- A readout that owns a canvas, a WebGL context or a WebGPU canvas context.
- A second renderer for segments beside the one for dots. Dots, bulbs and segments are one light
  table drawn by one set of shaders per backend.
- A segment that skips the optics, for example one lit straight from the value without passing
  through `Pose` and the optics.

## Display types

All of these ship (2026-11-04). The first six are built and checked first, and the rest follow in
the same build.

| type          | shows                        | cells                                   |
| :------------ | :--------------------------- | :-------------------------------------- |
| `seven`       | digits, A–F, rough letters   | 7 bars, a decimal point; `:` cell       |
| `fourteen`    | full alphabet, digits        | 14 bars, decimal point and comma (the pinball plasma display) |
| `sixteen`     | alphabet, punctuation        | 16 bars (top and bottom split), DP      |
| `nixie`       | digits                       | 10 stacked numeral cathodes             |
| `cistercian`  | 0–9999 per cell              | stem and 4 quadrants of 5 strokes       |
| `matrix`      | bree's 5×7 font              | 35 dots                                 |
| `eight`       | digits                       | 7 bars and a diagonal for 4 (F. W. Wood's 1908 patent) |
| `nine`        | digits, Z, slashed 7         | 7 bars and 2 diagonals, DP              |
| `half`        | a leading 1 and a minus      | the ½ digit of a 3½-digit meter          |
| `twentytwo`   | upper and lower case         | 22 bars, room for descenders            |
| `maya`        | base 20                      | 4 dots, 3 bars, a shell for zero        |
| `kaktovik`    | base 20                      | 3 five-bars, 4 one-strokes              |
| `rods`        | counting rods                | 5 rods, crossbar; alternating by place  |
| `braille`     | letters, digits              | 6 dots                                  |
| `ogham`       | letters                      | stemline, 5 each of right, left, cross strokes and notches |
| `morse`       | letters, digits              | 5 places of a dot or a dash             |
| `semaphore`   | letters                      | hub and 8 arms                          |
| `dice`        | 0–9                          | 9 pips                                  |
| `tally`       | counts                       | gates of 4 strokes and a slash          |
| `bcd`         | digits                       | 4 lamps per digit                       |
| `bargraph`    | a level from 0 to 1          | N bars                                  |

The visual companion's mockup of each, with sample text, is
`.superpowers/brainstorm/51653-1793823017/content/display-types-v2.html` (not committed, since
`.superpowers/` is ignored). Its shapes are a sketch. The real glyph tables follow the notations
themselves: standard 7/14/16-segment character sets, Unicode's Kaktovik and Maya digits, Grade 1
Braille, International Morse, and the standard semaphore alphabet.

## How it works

### The light table grows from discs to primitives

`src/render/lights.ts` now holds a light as a disc: a place, a radius and a `SHAPES` value. It
becomes a table of **primitives**, each owned by one light:

- **disc**: a center and a radius. Dots, bulbs, decimal points, colon dots, pips and Braille dots.
- **bar**: two endpoints, a half-width, and an end style. Every segment stroke.
- **stroke glyph**: a curved shape read from a distance-field atlas, at a place and a size. Nixie
  cathodes.

A light owns one primitive or several. A colon is one light with two discs. The
optics run once per light, and every primitive of that light draws what the light shows. Housing
(the socket of an unlit light), glow and body pass over primitives, not lights. That is how unlit
segments show their dark socket, the same way unlit dots do.

The fragment shaders draw each primitive from a signed distance: a disc's is its radius, and a
bar's is the distance to its segment minus its half-width, shaped by its end style. Glow is a
Gaussian of that distance, so a bar's halo follows the bar. The 2D backend draws the same shapes
with paths. The shader copy and the TS copy of the distance function get an agreement test, as
every other shader here has.

End styles are `point` (the hexagonal bar of a real 7-segment), `round` and `square`. A type
chooses its default, and a readout may override it.

### Nixie cathodes

A Nixie numeral is a bent wire, so it gets its own primitive rather than a chain of bars: chained
bars overlap at every joint, and additive blending makes a bright bead at each one. Each numeral is
a single-stroke path (the Hershey simplex digits, which are public domain, or a hand-traced set in
the same form). At startup the paths are rendered once into a small distance-field atlas, ten
cells, which the WebGPU and WebGL shaders sample and the 2D backend replaces by stroking the paths.
Its distance feeds the same coverage and glow as the other primitives.

The tube is drawn the way a real one looks (2026-11-04):

- The cathodes are stacked front to back in a real tube's order (the IN-14's is 1 6 2 7 5 0 4 9 8
  3), and the lit one glows through the unlit wires in front of it, which darken it slightly where
  they cross.
- An unlit cathode is a hairline of dull metal, not a socket the width of a lit stroke, so the
  stack reads as a faint tangle of wire rather than ten overlapping numerals.
- The glow is a wide, soft orange cloud round the lit stroke, wider than an LED's bloom, set by
  the type's own glow default.

### A readout's layout

A type defines one **cell** in its own units: the shapes of its lights, and each light's place in
the cell's line structure. A readout of `n` cells lays copies side by side, with a gap and an
optional slant (italic 7-segment digits are common). Some cells are narrow: a `:` cell in `seven`,
which `set('12:34')` places itself.

The optics' ghosts sum each row and each column of a dot grid, and that models a multiplexed
matrix leaking along its lines. For segments, the lines are **segment slot × cell**: the same
segment across every digit is one line, and each digit is the other. That is how a real
multiplexed segment display ghosts, with the same segment faintly lit on the neighboring digits.
Ghosts stay inside a readout; two readouts on a surface never ghost into each other. Defects are a
readout option and address a segment by `{ cell, slot }` where a marquee's address a dot by
`{ x, y }`, so a dead segment or a stuck one works the way a dead dot does.

### Where a segment is, for effects

A segment's fields for the mix (`fieldsOf`, which orders and shaders rank by) are local to its
readout and fixed: its column is its cell's index, its row is its slot's height in the cell, and
its `x`, `y` are its midpoint in cell units plus the cell's offset. A layer cued on a readout
sweeps that readout, and scrolling or moving a readout never touches the fields. Where the rank
code reads a board-wide `cols`, a readout supplies its cell count.

Because nothing cues layers yet, tests prove the effects reach segments by cueing a layer on a
readout's subjects through the surface's mix, which the tests reach from `src/` directly. No lab
page or public API gets that path.

### Bloom

A marquee blurs its glow across the whole canvas at a radius set by its one pitch. A surface has
readouts of many sizes, so it drops that full-screen blur and relies on each primitive's own
Gaussian glow, sized by its readout's scale. Nixie's wide cloud is a larger sigma on the same pass.

### Encoders

A type's encoder turns a value into the lit lights of each cell:

- Text types (`seven`, `eight`, `nine`, `twentytwo`, `fourteen`, `sixteen`, `matrix`, `braille`, `morse`, `ogham`,
  `semaphore`) map characters through a table. A `.` after a character lights that cell's decimal
  point instead of taking a cell, where the type has one. A character the table lacks shows blank.
- Number types (`nixie`, `cistercian`, `maya`, `kaktovik`, `rods`, `dice`, `tally`, `bcd`) take a
  number. `cistercian` packs four decimal places into one cell; `maya` and `kaktovik` write base
  20, laid out left to right like the others; `tally` fills gates of five.
- `bargraph` takes a level from 0 to 1 and lights that share of its bars.
- `half` takes `1`, `-`, `-1` or nothing, and sits as the leading cell of a `seven` readout
  (`{ type: 'seven', cells: 3, half: true }`).

Numbers align right and text aligns left, and either can be overridden. A value too long for the
readout shows its last cells for numbers and its first cells for text.

### Showing a value goes through the mix

A readout's value becomes `lit` through a voice in the surface's mix. Nothing writes `lit` into
the columns directly. On WebGPU that voice is a shader patch reading a table of each light's
target, which `set` rewrites (blits 1.0's shader `tables`, the way `src/moves/shader.ts` reads the
message bitmap), so `lit` stays on the GPU. Later effects cue on a readout's subjects in the same
mix and fold with it under the existing rules.

### Surfaces: a panel or a page overlay

A **surface** owns one canvas, one sign and one mix for every readout on it. There are two kinds,
and a page may use either (2026-11-04):

- **Panel.** You give it a canvas. Each readout is placed at a position and height in the panel's
  CSS pixels. This is for an instrument panel drawn as one picture.
- **Overlay.** One canvas, fixed over the viewport with `pointer-events: none`. Each readout
  follows a page element and is drawn fitted inside that element's box, keeping the type's aspect
  ratio and centered. This is for numbers scattered through ordinary page layout, such as one
  inside each dashboard card. Each frame the overlay reads every followed element's rectangle and
  clips the readout to what its scrolling ancestors let show. A readout whose element is off
  screen or `display: none` draws nothing and skips the optics.

Either kind of surface supports both backings, chosen per readout with `face` (2026-11-04):
`'plate'` draws a dark faceplate fitted round the readout's cells, with unlit segments showing
their sockets on it, like a real display window; `'none'` draws no plate, and an unlit segment
draws nothing, so only lit segments and their glow sit over the page. Default `'plate'`.

Placement is a transform per readout (offset, scale, slant) in a small buffer that every
primitive indexes through its readout. Moving a readout rewrites its transform, not the light
table. Adding or removing a readout rebuilds the tables, which is rare.

### API sketch

The builder may change names. The shape is what matters.

```ts
const surface = createPanel(canvas, { gpu, backend });       // or createOverlay({ gpu, backend })
const clock = surface.readout({ type: 'seven', cells: 5, at: { x: 20, y: 20 }, height: 64 });
const score = overlay.readout({ type: 'nixie', cells: 4, follow: element });
clock.set('12:34');
score.set(1984);
clock.color(0x6cff8a);                                       // tint, as hex
clock.destroy();
surface.destroy();
```

Readout options cover `type`, `cells`, `face`, `color`, `slant`, `ends`, `align`, a gap between cells,
`ghost` and `defects`. Surface options carry what a marquee's do for drawing: `gpu`, `backend`,
`lamps`, `fade` and `ticker`.

## Constraints

- Published source keeps relative imports; the lab and tests use the `@/` alias.
- No source file past a few hundred lines. Glyph tables go in their own module per type family,
  not in one big table file.
- Each shader with a TS copy gets an agreement test; GPU-only checks go in `test/gpu/` and run
  with `npm run test:gpu`.
- The digits bench page (`lab/digits.ts`) gains a `readouts` way: N `seven` readouts on one panel,
  with the same `?stack=` param as the other ways. With no layers it measures readouts against the
  `separate` and `shared` rows run with an empty stack. There's no speed target, but a readouts
  row much slower than `shared` at the same count is a finding to report, not to ship quietly.

## Left to the builder

- Glyph tables' exact contents, and the geometry of each type's cell.
- The Nixie stroke paths and the atlas's resolution.
- Where the readout API lives in `src/` and what it exports from `src/index.ts`.
- Whether the marquee's dots move to the primitive table in the same change, or are adapted to it.
  Either way they draw through the same shaders by the end.
- A lab page at `/readouts` showing every type live (a clock, a counter, typed text) on both a
  panel and an overlay.

## After this

To file in `TODO.md` when this lands: whole marquees on a shared surface, which the lab's
thumbnails need to leave 2D; readouts taking layers and effects through a public option; and
materials beside LED for the other segment technologies: Numitron (glowing filaments), flip
segments (reflective faces flipped by a magnet) and VFD (blue-green phosphor behind a grid).
