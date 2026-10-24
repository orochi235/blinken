"""Writes bree face tables from faces.json: one module per face, an index, and the credits list.

usage: gen.py <faces.json> <bree src/glyphs/fonts dir>
"""
import json
import os
import sys

SRC, OUT = sys.argv[1:3]

# json name -> (bree name, about, credit). Fonts with a Reserved Font Name take another name here.
META = {
    "Tom Thumb": ("tom-thumb", "Tiny 3 × 5 capitals.", "Tom Thumb, Robey Pointer after Brian Swetland, CC0 — https://robey.lag.net/2010/01/23/tiny-monospace-font.html"),
    "Bytesized": ("bytesized", "Crude 3 × 4 micro capitals.", "Bytesized, Copyright 2024 The Bytesized Project Authors (https://github.com/balt-dev/bytesized-gf), OFL 1.1"),
    "Micro 5": ("micro-5", "Condensed 5-row capitals, proportional.", "Micro 5, Copyright 2023 The Soft Type Project Authors (https://github.com/scfried/soft-type-micro), OFL 1.1"),
    "Tiny5": ("tiny5", "Rounded 4 × 5 sans.", "Tiny5, Copyright 2022-2024 The Tiny5 Project Authors (https://github.com/Gissio/font_tiny5), OFL 1.1"),
    "Silkscreen": ("silkscreen", "Classic square 5-row UI letters.", "Silkscreen, Copyright 2001 The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen), OFL 1.1"),
    "Raster Forge": ("raster-forge", "Bold 5-row letters with 2-dot stems.", "Raster Forge, GGBotNet, CC0 — https://ggbot.itch.io/raster-forge-font"),
    "QuinqueFive": ("ggbot-square", "Square, wide 5 × 5 letters.", "Derived from QuinqueFive, Copyright © 2019-2025 GGBotNet (https://ggbot.net), with Reserved Font Name \"QuinqueFive\", OFL 1.1"),
    "Org_01": ("org-01", "Square, futuristic 5 × 5 letters.", "Org_01 by Orgdot (http://www.orgdot.com/aliasfonts/), via the Adafruit GFX Library; free to copy, use, modify and distribute with this notice"),
    "Kenney Rocket": ("kenney-rocket", "Extended, futuristic 7-row letters with round corners.", "Kenney Rocket, Kenney (https://kenney.nl), CC0"),
    "Kenney Rocket Square": ("kenney-rocket-square", "Extended, futuristic 7-row letters with square corners.", "Kenney Rocket Square, Kenney (https://kenney.nl), CC0"),
    "Kenney Mini": ("kenney-mini", "Rounded 4 × 5 letters.", "Kenney Mini, Kenney (https://kenney.nl), CC0"),
    "Kenney Mini Square": ("kenney-mini-square", "Square 4 × 5 letters.", "Kenney Mini Square, Kenney (https://kenney.nl), CC0"),
    "Not Jam Chunky Sans 6": ("notjam-chunky-sans", "Heavy 5-row sans.", "Not Jam Chunky Sans 6, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "Undead Pixel 8": ("undead-pixel", "Soft, rounded 6-row letters.", "Undead Pixel 8, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "m3x6": ("m3x6", "Condensed 3 × 6 game-UI letters.", "m3x6 by Daniel Linssen (https://managore.itch.io/m3x6), free to use with attribution"),
    "Not Jam Chunky 8": ("notjam-chunky", "Ultra-black 6-row letters with 3-dot stems.", "Not Jam Chunky 8, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "Cairopixel": ("ggbot-slab", "Slab-serif 7-row letters.", "Derived from Cairopixel, Copyright © 2025 GGBotNet (https://ggbot.net), with Reserved Font Name \"Cairopixel\", OFL 1.1"),
    "Not Jam Serif 11": ("notjam-serif", "Bold, wide Roman serif.", "Not Jam Serif 11, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "monogram italic": ("monogram-italic", "A true italic, 5 × 7.", "monogram extended italic, datagoblin (https://datagoblin.itch.io/monogram), CC0"),
    "Scientifica Italic": ("scientifica-italic", "Narrow italic, 4 × 7.", "Scientifica Italic, Copyright (c) 2021, Akshay Oppiliappan; Copyright (c) 2015, romeovs (https://github.com/oppiliappan/scientifica), OFL 1.1"),
    "Not Jam Manuscript 8": ("notjam-manuscript", "Calligraphic, handwritten capitals.", "Not Jam Mono Manuscript 8, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "Not Jam Old Peculiar 8": ("notjam-old-peculiar", "Heavy, blackletter-like capitals.", "Not Jam Mono Old Peculiar 8, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "Not Jam Prophet 8": ("notjam-prophet", "Bold capitals with flared ends.", "Not Jam Mono Prophet 8, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "Not Jam Casual 10": ("notjam-casual", "Thin, casual handwriting.", "Not Jam Mono Casual 10, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "Not Jam Crooked 8": ("notjam-crooked", "Wobbly, bold handwriting.", "Not Jam Mono Crooked 8, Not Jam (https://not-jam.itch.io/not-jam-font-pack), CC0"),
    "Kenney Blocks": ("kenney-blocks", "Letters cut out of solid blocks.", "Kenney Blocks, Kenney (https://kenney.nl), CC0"),
    "Public Pixel": ("public-pixel", "Bold, extended 7-row letters.", "Public Pixel, GGBotNet (https://ggbot.itch.io/public-pixel-font), CC0"),
    "m5x7": ("m5x7", "Plain 5 × 7 game-UI letters.", "m5x7 by Daniel Linssen (https://managore.itch.io/m5x7), CC0"),
    "Pixeloid Sans": ("ggbot-sans", "Plain, even 7-row sans.", "Derived from Pixeloid Sans, Copyright © 2020-2025 GGBotNet (https://ggbot.net/fonts/), with Reserved Font Name \"Pixeloid\", OFL 1.1"),
    "Galmuri7": ("galmuri7", "Neat 5 × 7 sans.", "Galmuri7, Copyright (c) 2019–2025 Lee Minseo (quiple@quiple.dev), OFL 1.1"),
    "Kenney Pixel": ("kenney-pixel", "Plain 7-row letters.", "Kenney Pixel, Kenney (https://kenney.nl), CC0"),
    "Spleen 5x8": ("spleen", "Terminal 5 × 6 letters.", "Spleen 5x8, Copyright (c) 2018-2026 Frederic Cambus, BSD 2-Clause"),
}

faces = json.load(open(SRC))
os.makedirs(OUT, exist_ok=True)


def ident(slug):
    head, *rest = slug.replace("-", " ").split()
    return "".join([head] + [w.capitalize() for w in rest]).replace("5", "Five").replace("1", "One") if slug[0].isdigit() else "".join([head] + [w.capitalize() for w in rest])


CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:'&*#$"

entries = []
for f in faces:
    slug, about, credit = META[f["name"]]
    packed = {}
    for ch in CHARS:
        dots = {tuple(d) for d in f["lit"].get(ch, [])}
        if not dots:
            continue
        xs, ys = [x for x, _ in dots], [y for _, y in dots]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        assert w <= 15 and h <= 15 and -8 <= y0 <= 7, (slug, ch, w, h, y0)
        digits = (h + 3) // 4
        cols = "".join(
            f"{sum(1 << k for k in range(h) if (x, y1 - k) in dots):0{digits}x}" for x in range(x0, x1 + 1)
        )
        packed[ch] = f"{w:x}{h:x}{y0 + 8:x}{cols}"
    entries.append((slug, about, credit, f["cap"], packed))

idx = [
    "import { packedFace } from '../table.js';",
    "",
    "/** Faces converted from published pixel fonts; CREDITS.md names each one's source and license. */",
    "export const IMPORTED = {",
]
for slug, about, _, cap, packed in entries:
    glyphs = ", ".join(f"{json.dumps(ch) if not ch.isalnum() else repr(ch)}: '{v}'" for ch, v in packed.items())
    idx.append(f"  '{slug}': packedFace('{slug}', {json.dumps(about)}, {cap}, {{ {glyphs} }}),")
idx.append("};")
open(f"{OUT}/index.ts", "w").write("\n".join(idx) + "\n")
for slug, *_ in entries:
    path = f"{OUT}/{slug}.ts"
    if os.path.exists(path):
        os.remove(path)
credits = open(f"{OUT}/CREDITS.md").read() if os.path.exists(f"{OUT}/CREDITS.md") else ""
tail = credits[credits.index("\nThe tables are generated"):] if "The tables are generated" in credits else ""
open(f"{OUT}/CREDITS.md", "w").write(
    "# Font credits\n\nThe faces in this directory are converted from these fonts. The OFL 1.1 text is in `OFL.txt` beside this file; the BSD 2-Clause notice for Spleen is in `spleen.LICENSE`.\n\n"
    + "\n".join(f"- `{s}`: {c}" for s, _, c, _, _ in entries)
    + "\n" + tail
)
print(f"wrote {len(entries)} faces")
