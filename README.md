# bree

An old-fashioned LED sign on a canvas: a grid of dots under a border of chasing bulbs, playing a
program of messages. Every dot is lit by one [blits](https://github.com/orochi235/blits) mix, and
every effect is a blits patch you can cue on a mix of your own. No three.js, no assets.

`bree` is a codename; the package is unpublished until it has a real one.

## A sign of its own

```ts
import { createMarquee } from 'bree';

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
sign.setLayer('sparkle', true, { rate: 0.02 }); // new params re-cue the layer
sign.restart(1); // play this pass from the second scene; later passes start from the first
sign.seek(1500, { hold: true }); // show the pass 1.5 s in, held there
sign.seek(1500); // and play on from there
sign.pass(); // { at, length, scenes: [{ scene, start, ms }, …] }, or null while nothing plays
sign.destroy();
```

The canvas takes the largest size its parent element allows. `program` loops; given as a function,
it is read again at the start of every pass. `layers` takes the name of a built-in with on, off or
a weight, or a full layer spec under a name of your own. `setEffects` replaces the effects scenes
can name from the next pass. `sign.mix` is the mix itself, for cueing voices of your own on
`sign.board`'s dots and cells. `name` is what debuggers list that mix as, by default
`marquee #<canvas id> <cols>×<rows>` (or `marquee <cols>×<rows>` for a canvas with no id), and
`destroy` takes it off their list.

`pass()` says where the pass playing now stands: `at` ms into it, its `length`, and each scene it
plays, end to end, with its index in the program, its `start` and its `ms`. It reads the mix clock,
so `ramp` slows it with everything else. `seek(ms)` moves that pass to `ms` from its start, back
into a scene that has ended as readily as forward, and `{ hold: true }` keeps it there until a seek
without it or the next restart.

## Thumbnails

`createThumbnail` loops one effect on a small sign, for a preview beside its name:

```ts
import { createThumbnail } from 'bree';

const thumb = createThumbnail(canvas, { effect: 'flip', text: 'OPEN', hex: 0xff4030 });
thumb.marquee.setEffects(mine); // a changed effect plays from its next pass
thumb.destroy();
```

It is a marquee of 32 × 7 dots by default, with no layers and the border's bulbs dark. `effect` is a built-in's name, one of `effects`, or a
spec; `text`, `hex`, `face` and `style` are as a scene's. Every thumbnail draws from one shared
ticker at 30 fps, and one scrolled out of view comes off it until it is back, so a page of them
costs only the ones on screen. `createTicker({ fps })` makes a ticker of your own, and
`createMarquee`'s `ticker` option runs any sign on one.

## Pieces, effects and programs

A piece is one thing happening to the dots. A move places the text: `stand` holds it, `scroll-across`
carries it over the sign, `tumble` turns each letter end over end. A modulator changes how the dots
look while it plays: `flash`, `pulse`, `hue-cycle`, `sparkle`, `chase`. Each declares its tuning as
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

The built-in effects are `hold`, `scroll`, `flip`, `roll`, `fall`, `matris` (Matrix rain), and
`tile`, in `EFFECTS`. The
built-in layers are `sparkle`, stray dots lighting for a moment; `chase`, the border's bulbs
stepping around; `rainbow`, a hue running across the sign that recolors whatever is lit; and
`invert`, which swaps lit and dark dots, held or swinging, and swept across the sign when spread by
column. They are in `LAYERS`. A layer plays under the whole sign through `layers` on
`createMarquee`, or under one scene through that scene's `layers`, by the same names:
`{ rainbow: true }`, or `{ rainbow: { params: { arc: 90 } } }` laid over the built-in's settings.
A scene's layer runs as long as the scene, and `on: false` keeps its settings without playing it.

## Faces and styles

A scene can name the face its message is drawn in and a style for it, as `face` and `style`:

```ts
program: [
  { effect: 'hold', text: 'NOW SHOWING', hex: 0xff4030, face: 'bold' },
  { effect: 'scroll', text: 'ALL NIGHT', hex: 0x6dff5a, face: 'slim', style: { monospace: true } },
  { effect: 'flip', text: 'OPEN', hex: 0xff9a2e, style: { reverse: true } },
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
into the gap between lines or the sign's margin; only the sign's edge cuts it. `style.reverse` is inverse video: the message's box lit and its letters dark.
Each letter is kerned by its shape, sliding left until its ink is a blank from the ink before it in
its own row and the rows either side, so letters never touch, even at a corner. An I takes three columns, and nj serif's J still tucks its
tail under an N.
`style.monospace` gives every letter the face's widest instead, five columns for the same I. A face can also be given in full, as a `Face` with `rows`,
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
```

With a blits checkout at `../blits`, the lab, tests and typecheck run on its source; `BLITS=npm`
or no checkout runs them on the published package. The build always compiles against the
published package.
