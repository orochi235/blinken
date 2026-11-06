# The player element

**Built** (2026-11-04). For anyone putting a blinken sign on a page, and whoever works on the player.
It answers: how a composition gets onto a page that has no build step, and what decides what it
plays and how its sign is built.

## On a page

`npm run compile` writes `dist-player/blinken-player.js`: one classic script, about 550 KB minified
and 195 KB gzipped, with blits, the fonts and the shaders inlined and nothing fetched. Loading it
defines `<blinken-player>`.

```html
<script src="blinken-player.js"></script>
<blinken-player program="…" cols="40" rows="7" grid="hex"></blinken-player>
```

The compose page's **copy embed** button writes exactly that for what is on screen: the
composition as a share string and the sign's hardware.

| Attribute              | What it sets                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `program`              | The composition: a share link, the part after its `#`, or a composition file's JSON                |
| `cols`, `rows`, `grid` | The sign's size and grid, as the hardware panel's size card                                        |
| `bulbs`                | `none`, `unlit`, `lit` or `chase`                                                                  |
| `housing`              | `dark` (the default), `clear` or `none`, as `createMarquee`'s `housing`; see below                 |
| `hardware`             | Any of the hardware panel's settings as JSON, by card: `{"fade":{"fall":400},"ghost":{"row":0.1}}` |

On a light page, `housing="clear"` draws each unlit dot as a faint gray veil, as faint on white as
on black, and `none` draws only lit dots. Neither paints a backing, so a page wanting one gives the
element a CSS `background`; blending it with the page, as with any element, is the page's CSS
(`mix-blend-mode`), not an attribute.

A program can also sit inside the element, as a composition file with an optional `hardware`
beside it, which is easier to write by hand than a share string:

```html
<blinken-player>
  <script type="application/json">
    { "blinken": "composition", "format": 2, "effects": {},
      "program": [{ "effect": "scroll", "text": "OPEN LATE", "hex": 16756736 }],
      "hardware": { "size": { "cols": 60 } } }
  </script>
</blinken-player>
```

## What wins

Each source overrides the one before: what was compiled in, then the JSON inside the element,
then its attributes. The program comes whole from the last source that names one. Hardware merges
setting by setting, so `cols="60"` changes only the width. A setting out of range, or one that
doesn't parse, falls back to its default, as the hardware panel's stored values do. Changing any
attribute rebuilds the sign.

A program that can't be read plays nothing and logs an error; one with parts the player doesn't
know plays the rest and logs a warning naming them. Old share links read as the lab reads them.

## Compiled in

`npm run compile -- <link or file.json> --out sign.js --tag shop-sign` compiles a program in, so
the file alone plays it: `<script src="sign.js"></script><shop-sign></shop-sign>`. `--cols`,
`--rows`, `--grid`, `--bulbs` and `--hardware` compile hardware in the same way. The program is
read while compiling, so one that can't be read fails then rather than on the page. A page can
still override anything with attributes. Two compiled signs on one page need different tags; a
tag already defined is left as it was.

Every compiled file carries the whole runtime, every effect and font included. Scenes name
effects at runtime, so a file can't be cut down to the ones its program uses without changing how
the registries are built.

## How it runs

The element draws in its shadow root, filling its width at the sign's own aspect ratio. Players
share one WebGPU device and one frame clock; without WebGPU they fall back to WebGL, then 2D. A
player off screen stops drawing until it scrolls back, and one removed from the page lets go of
its canvas. Without WebGPU, blinken gives a page 12 WebGL contexts, one per sign on it, and signs
past the twelfth draw in 2D.

The element is `player/element.ts`; what it reads from where is `player/config.ts`, which the
compiler also uses to check a program before compiling it in. The share codec and the hardware
settings are the compose page's own (`lab/compose/share.ts`, `lab/compose/sign-hardware.ts`), so a
composition plays the same in the lab and on a page.
