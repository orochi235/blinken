# Changelog

This package follows [semver](https://semver.org): before 1.0.0 a breaking change bumps the minor
version, and anything else the patch. Each release lists its changes as **Breaking**, **Added** and
**Fixed**, and the release workflow refuses a tag with no section here.

## Unreleased

**Added**

- Readout types copying real parts, segment layout, character set and color: `dl3422` (22 segments
  with descenders), `dl2416`, `dl3416`, `hdsp2000`, `hdsp211x`, `dl330m`, `hp50827415` and `dl34`.
  A `DisplayType` now carries its default `color`.
- `@msb235/blinken/mechanical`: odometer reels and split-flap cards on a 2D canvas, turning forward
  through any glyphs you give them (characters, words, or `DrawnGlyph`s that paint themselves),
  styled per readout and per cell with `style`, `each` and `setStyle` (the housing, `gap` and
  `padding` per readout only). A reel turning more than a glyph a frame blurs along its turn
  rather than strobing.
- Readouts take a `transition` for how `set` moves them to a new value: `fade`, `scramble`,
  `count`, `wipe`, `flap` (each cell steps through the alphabet, as a split-flap board's cards do) or
  `roll` (each digit rolls up, as an odometer's wheels do), from `TRANSITIONS`, or a `Transition` of
  your own; `transitionMs` sets how long, and `setTransition` changes it. Set again mid-change, a
  readout turns on from what it shows.
- `createTransition` makes a transition from its settings: a `move` for each cell (`cut`, `fade`,
  `step` through any characters, `scramble` or `count`), an `order` the cells turn in, a `spread`
  between their turns, and an `easing`. The built-ins are made this way and carry their `recipe`.

**Fixed**

- Over a white page, a lit dot on the `clear` or `none` housing keeps its color instead of reading
  as a pale ring: its white core is fainter on a housing that lays lights over the page.
- A sign or surface whose canvas would pass the backend's texture limit (8192 device pixels a
  side on WebGPU by default) draws at a lower pixel ratio instead of not at all, and warns once.
- A scrolling message no longer trails afterglow that fills the gaps between its letters: while a
  scroll plays, the sign's lights fall no slower than ¾ of a column step, unless the page set a
  `fall`. A move can ask for this with `fall`.
- `dim` and `desaturate` hold where they end on every pass after the first, rather than snapping
  back each time they repeat.
- An overlay stacks above elements the page adds after it (`z-index` from `--blinken-overlay-z`), so
  a card added later no longer covers a readout or takes the presses meant for it.
- The 22-segment `e` closes its bowl and `k`'s leg meets its stem, as the DL-3422 draws them.
- Lines of outlined or shadowed text no longer overlap: lines stand the rows a style adds further
  apart, both in a `\n`-separated message and in one repeated down a tall board. `Bitmap.pitch` gives
  the spacing.
- A drag from one readout runs on into every readout it reaches, on the same panel or overlay or
  another, as a drag across text does, taking in the readouts between in reading order on the page
  and none of the page's other text; Shift+click extends from a press in another readout, and a
  copy writes each readout's line in that order.
- A selection or caret in a readout survives its surface rebuilding (`setSelection`, `setDefects`,
  or a readout added or destroyed): a caret stays in its own readout rather than the next, a
  selection over several readouts keeps them all, a drag carries on, and the page's `onBlur` no
  longer fires for it. A drag no longer outlives its surface.
- A double-click selects one word in a readout on several rows, and on either half of a character
  in an editable one. Shift+click in an editable readout extends a backward selection from its
  anchor, and after a press outside every readout it no longer extends from an old press.
- A border of all-lit bulbs (`border: { bulbs: 'lit' }`) runs on the GPU, rather than keeping the
  whole sign's `lit` and `tint` on the CPU under WebGPU.
- The WebGPU and WebGL renderers draw signs of 125,000 lights and more, where they overflowed the
  stack.
- The WebGPU renderer paints the housing's sockets from its first frame, where the first paint drew
  them unset.
- A sign fitted to its box sizes its canvas as its CSS size times the pixel ratio, where a box of
  fractional width had the browser squeeze a pixel or two out of it.
- Under WebGPU, readouts keep their selection's highlight when they relay out, and a sign that
  relays out keeps the sign it follows and reads back its new poses.
- A WebGL sign made on a canvas whose last sign was destroyed while its context was lost draws once
  the context is restored, where it stayed dark for good.
- On a 2D canvas, each readout's glow spreads by its lights' own `glow`, as WebGL and WebGPU spread
  it.
- An effect with an `order` waits once at each rest its groups share: a lag-0 order over a message
  typed by input takes one press a letter rather than one a letter for every group.
- `setProgram` throws at the call on a scene whose layer names nothing or a modulator that does not
  exist, rather than the sign going idle when the pass starts.
- On a message of several lines, `split-in` and `split-out` part each line through its own
  letters, and `wave` by letter bobs each line's letters whole, rather than reading every line as
  the last.
- A still thumbnail played with `play(true)` fades its dots as a sign does, rather than keeping the
  instant on and off it holds with.
- `dim`, `desaturate` and `flare` take their whole `ms` when nothing spreads them, where the
  default sweep finished the change in half of it.
- On the `triangles` grid, tracking spaces letters across its whole range, where 3 to 6 all spaced
  them alike. A `Face` takes `spread`, the places one of its columns stands for.
- `reel-in` spins through the glyphs of the face its message is in when two custom faces share a
  name.
- On WebGPU, a move played in an order with a lag, and a modulator spread by letter or at random
  (the `neon` layer among them), fold on the GPU, where they kept their channels on the CPU.

## 0.2.0

**Breaking**

- A readout whose type spells letters or numbers is selectable by default, and on an overlay its
  cells now take the pointer. Pass `select: false` for an overlay readout over something clickable.

**Added**

- Readouts that spell can be selected and copied as text, with `selection` choosing how a selected
  cell shows (`glow`, `recolor`, `underline`, `invert` or `block`), exported as `Selection` and
  `SELECTIONS`, and `setSelection` to change it. `copy` picks the shown case or the value's own.
- `edit: true` makes a readout typed into, with `onInput`, `onKeyDown`, `onBlur`, `label`, `field`
  and `setField` for building a control from one.
- `lines` lays a readout out on several rows, word-wrapped unless `wrap: false`.

**Fixed**

- A sign slower than 4 fps plays instead of rebasing every frame.
- A WebGL sign made while every slot is taken draws once a slot frees.
- A followed sign is laid out on repaint and `setHighlight` alike.
- WebGPU no longer allocates per frame for its plan, channels, picks and bulb list.

## 0.1.0

The first release: `createMarquee` and its effects, layers and hardware, the WebGPU, WebGL 2 and 2D
renderers, segment readouts, and `<blinken-player>` for pages with no build step.
