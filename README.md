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
sign.restart(1); // play this pass from the second step; later passes start from the first
sign.destroy();
```

The canvas takes the largest size its parent element allows. `program` loops; given as a function,
it is read again at the start of every pass. `layers` takes the name of a built-in with on, off or
a weight, or a full layer spec under a name of your own. `setEffects` replaces the effects steps
can name from the next pass. `sign.mix` is the mix itself, for cueing voices of your own on
`sign.board`'s dots and cells.

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
pass over the hold. A program is a list of steps, each a message with its color
and the effect it plays; a step names an effect or carries one inline. Each step starts where the
one before it ends.

The built-in effects are `hold`, `scroll`, `flip`, `roll`, `fall` and `tile`, in `EFFECTS`. The
built-in layers are `sparkle`, stray dots lighting for a moment; `chase`, the border's bulbs
stepping around; and `rainbow`, a hue running across the sign that recolors whatever is lit. They
are in `LAYERS`.

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
`glow` by `mul`. `play(mix, board, steps, effects?)` cues one pass of a program on an owner of its
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
