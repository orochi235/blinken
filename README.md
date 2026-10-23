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
  program: [
    { how: 'hold', text: 'NOW SHOWING', hex: 0xff4030 },
    { how: 'scroll', text: 'TONIGHT ONLY', hex: 0xff9a2e },
  ],
  layers: { chase: true, sparkle: true },
});

sign.setLayer('rainbow', true);
sign.destroy();
```

The canvas takes the largest size its parent element allows. `program` loops; given as a function,
it is read again at the start of every pass. `sign.mix` is the mix itself, for cueing voices of your
own on `sign.board`'s dots and cells.

## The effects on your own mix

`board(cols, rows)` lays out the dots and the border, `KIT` is the pose they fold to (`lit` by
`max`, `tint` by color), and `play(mix, board, steps)` cues one pass of a program on an owner of its
own. `cueLayer` cues a layer looping. `createSign` draws a board from the mix's pulled columns, or
pull them yourself and draw them however you like.

| Effect | Kind | What it does |
|---|---|---|
| hold | text | Stands centered and flashes midway, wiping on and off a column at a time. |
| scroll | text | Crosses the sign a whole column at a time. |
| flip | text | Letters unfold from edge on, tumble end over end and fold away, staggered by letter. |
| roll | text | Each letter a slot reel spinning through random glyphs, landing left to right. |
| fall | text | Columns drop in from above at random and later fall out the bottom. |
| tile | text | The message in tilted brick rows over the whole sign. Needs room for two lines. |
| sparkle | layer | Stray dots lighting for a moment. |
| chase | layer | One border cell of three lit, stepping a cell a beat. |
| rainbow | layer | Hue running across the sign; it writes only `tint`, so it recolors whatever is lit. |

Each effect declares its tuning as `params`, plain data giving each number's label, range and
default, for a control panel to be built from.

## Development

```sh
npm run dev      # the lab, http://localhost:4885 and the same port on the LAN
npm run smoke    # build the lab, play it headless at three sizes
npm run shots    # build the lab, screenshot each effect alone into shots/
npm run check    # lint, typecheck, tests
```

With a blits checkout at `../blits`, the lab, tests and typecheck run on its source; `BLITS=npm`
or no checkout runs them on the published package. The build always compiles against the published
one.
