# blinken

An old-fashioned LED sign on a canvas: a grid of dots under a border of chasing bulbs, playing a
program of messages. Every dot is lit by one [blits](https://github.com/orochi235/blits) mix, and
every effect is a blits patch you can cue on a mix of your own. No three.js, no assets.

## On any page

`<blinken-player>` is one script with everything inlined, which plays a composition from the
lab's compose page on any page without a build step. The package ships it, so a CDN serves it:

```html
<script src="https://cdn.jsdelivr.net/npm/@msb235/blinken@0.1.0"></script>
<blinken-player program="…" cols="40" rows="7"></blinken-player>
```

A bundler can import it as `@msb235/blinken/player`, and `npm run compile` builds it from a checkout.

Compose's **copy embed** gives those two lines for the composition and sign on screen. Giving
`compile` a link or a composition file compiles that program in, for a sign in one file. Everything
it takes is in [docs/player.md](docs/player.md).

## A sign of its own

```ts
import { createMarquee } from '@msb235/blinken';

const sign = createMarquee(canvas, {
  cols: 80,
  rows: 7,
  effects: {
    blink: {
      name: 'blink',
      about: 'Stands still and flashes.',
      active: [{ move: 'stand' }, { mod: 'flash', params: { flashes: 4 } }],
      hold: 2000,
    },
  },
  program: [
    { effect: 'hold', text: 'NOW SHOWING', hex: 0xff4030 },
    { effect: 'blink', text: 'TONIGHT ONLY', hex: 0xff9a2e },
    { effect: 'scroll', text: 'SEE YOU THERE', hex: 0x6dff5a },
  ],
  layers: { chase: true, sparkle: true },
});

sign.setLayer('rainbow', true);
sign.setLayer('sparkle', true, { share: 0.02 }); // new params re-cue the layer
sign.restart(1); // play this pass from the second scene; later passes start from the first
sign.seek(1500, { hold: true }); // show the pass 1.5 s in, held there
sign.seek(1500); // and play on from there
sign.pass(); // { at, length, waiting, scenes: [{ scene, start, ms }, …] }, or null while nothing plays
sign.destroy();
```

The canvas takes the largest size its parent element allows. `program` loops; given as a function,
it is read again at the start of every pass. `layers` takes the name of a built-in with on, off or
a weight, or a full layer spec under a name of your own. `setEffects` replaces the effects scenes
can name from the next pass. `sign.mix` is the mix itself, for cueing voices of your own on
`sign.board`'s dots and cells. `name` is what debuggers list that mix as, by default
`marquee #<canvas id> <cols>×<rows>` (or `marquee <cols>×<rows>` for a canvas with no id), and
`destroy` takes it off their list.

`housing` is what shows round the lights: `'dark'`, the default, paints a dark housing with a
socket for every dot; `'clear'` leaves the housing see-through and draws each socket as a faint
gray veil, standing out from a white page as much as from a black one and as much as from the
dark housing, so one sign reads alike on either (a page of middle gray hides it); `'none'` draws neither, so only lit light shows and an unlit dot is simply absent. Ghosting
is light, so it still shows under `'none'`. `createThumbnail` takes it too.

`pass()` says where the pass playing now stands: `at` ms into it, its `length`, and each scene it
plays, end to end, with its index in the program, its `start` and its `ms`. It reads the mix clock,
so `ramp` slows it with everything else. `seek(ms)` moves that pass to `ms` from its start, back
into a scene that has ended as readily as forward, and `{ hold: true }` keeps it there until a seek
without it or the next restart.

### Paced by input

`type-on` and `type-off` take a `pace` setting, `time` by default. Set to `input`, the sign holds
before each letter and moves on when `sign.step()` is called, however long that takes; bind it to
whatever input you like, such as a key press. The built-in `type` effect lets a scene set it:

```ts
{ effect: 'type', text: 'HELLO', hex: 0xff9a2e, params: { pace: 'input' } },
// …
addEventListener('keydown', () => sign.step()); // each press types the next letter
```

Typing on, it waits first with the cursor showing and nothing typed, and the press that puts the
last letter down lets the cursor's blink and the rest of the pass play on; backspacing mirrors it. Each press jumps
straight to the next letter rather than playing up to it. A seek or a restart drops the wait, and a
looping program waits again on its next pass. Layers keep playing while it waits, `pass()` says
`waiting: true`, and its `at`, the scrubber and thumbnails keep the nominal timing.

A move is paced this way by declaring `rests(at, params)`: where in its own time it waits, and
`release`, where it plays on from after the last wait, or null when its settings pace it by time.
Staging turns them into the effect's `stops`, which `layOut` places in pass time.

### Grids

`grid: 'hex'` sets each row of dots half a dot left of the one above, rows √3/2 apart, so every
dot has six neighbors a pitch away. Text and effects still count dots by column and row, so the
columns run on a slant and the text leans like italics; the border follows the dots round. A
function `(x, y) => [x, y]` places dots a grid of your own way, in pitches, and the sign is
fitted to wherever they land. Default `square`.

`grid: 'triangles'` makes each place a triangle: regular hexagons each cut into six, which is rows
of triangles pointing up and down in turn. Each triangle is its own light, so effects play on them
one by one. Text keeps its face, each dot of a letter lighting the two triangles at its place, so
the sign is 160 places across by default where a square one is 80. The `strokes` face draws a
triangle to a dot instead, its letters sampled from 16-segment strokes, on 14 rows or more.
`lamps.size` shrinks each triangle toward its middle, leaving dark seams.

## GPU

A sign draws with WebGPU, WebGL 2 or 2D. Ask the browser for a WebGPU device once per page and give it
to every sign; `gpu()` resolves to null where there is none:

```ts
import { createMarquee, gpu } from '@msb235/blinken';

const g = await gpu(); // once per page
const a = createMarquee(canvasA, { gpu: g }); // WebGPU, or WebGL where g is null
const b = createMarquee(canvasB, { backend: '2d' }); // forced
a.backend; // 'webgpu' | 'webgl' | '2d': what is drawing; FrameCost.backend says the same
```

`createThumbnail` takes the same two options. With no `gpu` a sign draws with WebGL where the
browser gives it a context, and with 2D otherwise. `backend: 'webgpu'` without a handle throws. A
WebGPU sign on a canvas that already holds another context throws too; a WebGL sign there falls
back to 2D.

- **WebGPU** folds effects on the GPU (computes each light's brightness and color for the frame there) wherever blits's `gpu` engine can, and draws from the buffers
  it folded into. A channel with a voice the engine can't run is folded on the CPU and uploaded.
- **WebGL** folds on the CPU, uploads the result and draws with shaders.
- **2D** is the canvas drawing, as before.

The GPU backends share one look: a softer filament and a real bloom, with each light's center color
within 1/255 of 2D's and its total light within 0.2%. [docs/gpu-renderers.md](docs/gpu-renderers.md) has the
measurements and what a frame costs on each.

- A canvas keeps the context type it first drew with. A canvas that has drawn with WebGL can't
  switch to 2D or WebGPU, and the reverse; give a sign that must switch a fresh canvas.
- When the WebGPU device is lost, every sign on it goes dark for good while `backend` still reads
  `'webgpu'`. A host watches `gpu.lost`, then asks for a new device and builds its signs again.
- A page has about 12 WebGL contexts. Signs past that draw in 2D, and `backend` says so.
- On WebGPU, reading `Marquee.columns` starts reading the sign's channels back from the GPU, which
  costs a little each frame and stops 60 frames after the last read. Their values land a frame
  behind what was drawn, and the first read finds what was last there, zeros on a new sign. On 2D
  and WebGL every channel is current.
- The effects that aren't folded on the GPU yet run on the CPU and look the same; `TODO.md` lists them.

## Thumbnails

`createThumbnail` loops one effect on a small sign, for a preview beside its name:

```ts
import { createThumbnail } from '@msb235/blinken';

const thumb = createThumbnail(canvas, { effect: 'flip', text: 'OPEN', hex: 0xff4030 });
thumb.marquee.setEffects(mine); // a changed effect plays from its next pass
thumb.destroy();
```

It is a marquee of 32 × 7 dots by default, with no layers and the border's bulbs dark. `effect` is a built-in's name, one of `effects`, or a
spec; `text`, `hex`, `face` and `style` are as a scene's. Every thumbnail draws from one shared
ticker at 30 fps, and one scrolled out of view comes off it until it is back, so a page of them
costs only the ones on screen. `createTicker({ fps })` makes a ticker of your own, and
`createMarquee`'s `ticker` option runs any sign on one.

## Readouts

Segment displays that show a value: 7-, 8-, 9-, 14-, 16- and 22-segment, Nixie tubes, the 5 × 7
matrix, and notations like Cistercian and Maya numerals, Braille, Morse and semaphore. `TYPES`
lists all 23, `triangles` and `triangles-fine` drawing letters on the triangle grid. Many readouts share one canvas and one sign, on a panel or over the page:

```ts
import { createOverlay, createPanel } from '@msb235/blinken';

const panel = createPanel(canvas, { gpu: handle });
const clock = panel.readout({ type: 'seven', cells: 4, at: { x: 20, y: 20 }, height: 64 });
clock.set('12:34'); // a `:` or `.` after a digit lights that cell's colon or point

const overlay = createOverlay({ gpu: handle });
const score = overlay.readout({ type: 'nixie', cells: 4, follow: card.querySelector('.score') });
score.set(1984);
```

A panel's readouts sit at `at` and `height` in its canvas's CSS pixels. An overlay is one canvas
fixed over the viewport; each of its readouts is fitted inside the element it follows and clipped
where that element's scrolling ancestors clip it. `face: 'none'` drops the dark faceplate, leaving
only lit segments over the page. A readout takes `color`, `slant`, `ends`, `align`, a leading ½
digit (`half`) and `defects` by `{ cell, slot }`; a surface takes `gpu`, `backend`, `lamps`,
`fade`, `ghost` and `ticker`. How they're drawn is in `docs/readouts.md`; the lab's `readouts`
page shows every type.

## Pieces, effects and programs

A piece is one thing happening to the dots. A move places the text: `stand` holds it, `scroll-across`
carries it over the sign, `tumble` turns each letter end over end. A modulator changes how the dots
look while it plays: `flash`, `pulse`, `hue-cycle`, `sparkle`, `chase`, and filters that dress the
whole sign — `scanline`, `fire`, `glitch`, `neon`, `shimmer`, `aurora`, and `gradient`. Each declares its tuning as
`params`, plain data giving each number's label, range and default, for a control panel to be
built from. `flash` blinks a number of times within a window of each pass, `from` and `to` as
shares of it, which is how `hold` flashes three times in the middle third of its hold.

An effect is plain data made of pieces: an `enter`, an `active` and an `exit` slot, each holding a
piece or several that play together, an optional `order` that staggers the dots (by column, by
letter, at random), and a `hold` time. In `active`, a piece whose `ms` is left unset plays one
pass over the hold. A program is a list of scenes, each a message with its color
and the effect it plays; a scene names an effect or carries one inline. Each scene starts where the
one before it ends.

An effect's `params` are what a scene playing it can tune, each with a label, an `about`, and the
settings it drives in `to`: `enter.0.ms` is the first enter piece's `ms`, `enter.0.lag` that
piece's order lag, and `lag` or `blend` the effect's own. It takes the kind, range and default of
the first of them, a number, a choice or a list of colors, and the rest must be of the same kind. A scene sets them by name, and `blend`, and `lag` on an effect with an order, are always
there besides:

```ts
fall: {
  // …its pieces
  params: {
    drop: { label: 'drop time', about: 'How long a column takes to fall.', to: ['enter.0.ms', 'exit.0.ms'] },
  },
},
// and in the program:
{ effect: 'fall', text: 'TONIGHT', hex: 0xff9a2e, params: { drop: 600, blend: 120 } },
```

`tuningOf(effect)` lists them as number settings, defaulting to what the effect sets, and
`tuned(effect, values)` is the effect as those values set it.

The built-in effects are `hold`, `scroll`, `flip`, `roll`, `fall`, `matris` (Matrix rain),
`tile`, `type` (typed on behind a cursor and backspaced off), `swarm` (dots flying together and
apart), `bounce` (letters bouncing in), `wave` (letters riding a wave), `melt` (dripping off the
bottom), and `shear` (halves sliding in from opposite edges), in `EFFECTS`. The
built-in layers are `sparkle`, stray dots lighting for a moment; `chase`, the border's bulbs
stepping around; `rainbow`, a hue running across the sign that recolors whatever is lit; and
`invert`, which swaps lit and dark dots, held or swinging, and swept across the sign when spread by
column; `scanline`, a bright band rolling down the rows like a CRT's; `fire`, a rising flicker from
deep red at the bottom to yellow at the top; `glitch`, rare bursts in which bands of rows jump color,
drop out or flip; `neon`, letters buzzing like failing tubes, a few worse than the rest (under a
whole sign, which has no message to go by, each six columns are a tube); `shimmer`,
a slanted glint sweeping across now and then; `aurora`, colors drifting in soft bands; and
`gradient`, a still blend of colors from edge to edge. They are in `LAYERS`. A layer plays under the whole sign through `layers` on
`createMarquee`, or under one scene through that scene's `layers`, by the same names:
`{ rainbow: true }`, or `{ rainbow: { params: { arc: 90 } } }` laid over the built-in's settings.
A scene's layer runs as long as the scene, and `on: false` keeps its settings without playing it.

## Faces and styles

A scene can name the face its message is drawn in and a style for it, as `face` and `style`:

```ts
program: [
  { effect: 'hold', text: 'NOW SHOWING', hex: 0xff4030, face: 'bold' },
  { effect: 'scroll', text: 'ALL NIGHT', hex: 0x6dff5a, face: 'slim', style: { monospace: true } },
  { effect: 'flip', text: 'OPEN', hex: 0xff9a2e, style: { outline: true } },
],
```

The faces are `standard`, the classic 5 × 7 letters and the default; `slim`, 3 × 7, fitting more
across the sign; `wide`, the standard letters with every column doubled; and `bold`, the standard
letters with each lit dot also lighting the one to its right. Beside them are faces converted from
published pixel fonts, from the 3 × 5 `tom-thumb` to the italic `monogram-italic`, the handwritten
`nj manuscript` and the extended `kenney-rocket`; `FACE_NAMES` lists them all, and
`src/glyphs/fonts/CREDITS.md` names each one's source and license. A face's lines are spaced by
its body, the height of its capitals: 7 dots for the drawn four, 3 to 7 for the converted ones. A
glyph that reaches above or below the body, such as a comma's tail, draws there in a ghost row,
into the gap between lines or the sign's margin; only the sign's edge cuts it.
`style.outline` draws each letter hollow, the ring of dots around it lit and the letter dark, and
`style.shadow` lays a dim copy of each letter one dot down and right, behind it; with both, the
shadow is the outline's. An outline takes a ghost row above and below the letters and a shadow one
below, and both are kerned like the letters, so outlined letters keep a blank between them.
`text.level(x, y)` gives each dot's brightness, 0 to 1, where `lit` only says whether it lights.
Each letter is kerned by its shape, sliding left until its ink is a blank from the ink before it in
its own row and the rows either side, so letters never touch, even at a corner. An I takes three columns, and nj serif's J still tucks its
tail under an N.
`style.monospace` gives every letter the face's widest instead, five columns for the same I. `style.tracking` adds
blank columns between letters, kerned or fixed pitch, from −1, which lets them touch, to 6; its
range is `LOOK.params.tracking`. A `\n` in a scene's text starts a new line: lines stack a blank row apart by the letters'
body, each centered on the widest, and the block plays as one message, so a sign shows both
lines once it is tall enough for them. A face can also be given in full, as a `Face` with `rows`,
`width` and a `glyph` for each character, and its ghost rows as `above` and `below`. A scene that
runs off the sign still plays, showing what fits, and staging it warns with the height of sign
that shows all of it.
`rasterize(text, { face, style })` lays text out as a `Bitmap` of its own `cols` and `rows`, with
each letter's columns in `letters`.

## Broken lights

A sign can have broken lights, which show their fault whatever the program asks of them: `dead`
never lights, `dim` lights at a fraction of its brightness, `flicker` drops out at random, and
`stuck` stays lit. Name them one by one, by a dot's column and row or a bulb's place in the border,
or let `scatter` break a share of the dots, the same ones for the same seed:

```ts
const sign = createMarquee(canvas, {
  defects: [
    { kind: 'dead', at: { x: 12, y: 3 } },
    { kind: 'stuck', at: { bulb: 5 } },
  ],
});
sign.setDefects(scatter(sign.board, { dead: 0.03, dim: 0.05, flicker: 0.01 }, 7));
```

Two more settings mimic the hardware. `fade` is how long a light takes to light and to go dark,
in ms; the default, 12 up and 110 down, is a filament's, and 0 for both is an LED's hard switch.
`ghost` is how much an unlit dot shows of its lit neighbors, as a multiplexed sign leaks current
along its drivers: `row` is the share of its row's mean brightness, `col` of its column's.

```ts
sign.setFade({ rise: 0, fall: 0 });
sign.setGhost({ col: 0.08 });
```

Faults, fade, and ghosting belong to the sign, not the mix, so a mix you pull yourself still reads
every light as sound; `createSign` applies them as it draws. The compose lab's sign pane sets all
three.

## On your own mix

`board(cols, rows)` lays out the dots and the border. `KIT` is the pose they fold to: `lit` by
`max`, `gain` by `mul`, `tint` by color, `hue` as an angle that adds and wraps, and `chroma` and
`glow` by `mul`. `play(mix, board, scenes, effects?)` cues one pass of a program on an owner of its
own, and `cueLayer` cues a layer looping. To draw it, pull the mix's columns every frame and hand
them to `createSign`; the border's bulbs take their cells' poses through `paintBulbs`:

```ts
const leds = [...b.dots, ...b.bulbs];
const cols = signColumns(leds.length);
const cells = signColumns(b.cells.length);
const sign = createSign(canvas, b, leds);

// every frame:
m.sync(now);
m.pull(b.dots, cols);
m.pull(b.cells, cells);
paintBulbs(b, cells, cols);
sign.render(cols, 0xff9a2e, dt);
```

Or pull the columns and draw them however you like.

## Development

```sh
npm run dev      # the lab, http://localhost:4885 and the same port on the LAN
npm run smoke    # build the lab, play it headless at three sizes
npm run shots    # build the lab, screenshot each effect alone into shots/
npm run check    # lint, typecheck, tests
npm run compile  # build <blinken-player> into dist-player/
npm run player:check  # play it on a bare page in headless Chromium
```

With a blits checkout at `../blits`, the lab, tests and typecheck run on its source; `BLITS=npm`
or no checkout runs them on the published package. The build always compiles against the
published package.
