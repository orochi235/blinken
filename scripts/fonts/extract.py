"""Turns candidate pixel fonts into blinken-style glyph rows and draws a specimen sheet in LED dots.

usage: extract.py <fonts dir> <out json> <out png> [name,name…]
"""
import json
import re
import struct
import sys
import zlib

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

FONTS, OUT_JSON, OUT_PNG = sys.argv[1:4]
CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-:'&*#$"
MAX_ROWS = 16

# name, kind, path under FONTS, cap height in px, license, top-8 pick
NJ = "itch-notjam/pack-x/NotJamFontPack/"
KEN = "kenney/x/Fonts/"
FACES = [
    ("Tom Thumb", "bdf", "tomthumb/tom-thumb.bdf", 5, "CC0", True),
    ("Bytesized", "ttf", "gf-bytesized/Bytesized-Regular.ttf", 4, "OFL", False),
    ("Micro 5", "ttf", "gf-micro5/Micro5-Regular.ttf", 5, "OFL", True),
    ("Tiny5", "ttf", "gf-tiny5/Tiny5[BLED,JITT,ROND,wdth,wght].ttf", 5, "OFL", False),
    ("Silkscreen", "ttf", "gf-silkscreen/Silkscreen-Regular.ttf", 5, "OFL", False),
    ("Raster Forge", "ttf", "itch-rasterforge/RasterForge_Font_1_1-x/RasterForge.ttf", 5, "CC0", True),
    ("QuinqueFive", "ttf", "itch-quinquefive-font/QuinqueFive_Font_1_20-x/QuinqueFive.ttf", 5, "OFL", False),
    ("Org_01", "gfx", "adafruit/Org_01.h", 5, "free w/ notice", False),
    ("Kenney Rocket", "ttf", KEN + "Kenney Rocket.ttf", 7, "CC0", True),
    ("Kenney Rocket Square", "ttf", KEN + "Kenney Rocket Square.ttf", 7, "CC0", False),
    ("Kenney Mini", "ttf", KEN + "Kenney Mini.ttf", 5, "CC0", False),
    ("Kenney Mini Square", "ttf", KEN + "Kenney Mini Square.ttf", 5, "CC0", False),
    ("Not Jam Chunky Sans 6", "ttf", NJ + "NotJamChunkySans6/Not Jam Chunky Sans 6.ttf", 5, "CC0", False),
    ("Undead Pixel 8", "ttf", NJ + "UndeadPixelLight8/Undead Pixel 8.ttf", 6, "CC0", False),
    ("m3x6", "ttf", "itch-m3x6/m3x6.ttf", 6, "free w/ attribution", False),
    ("Not Jam Chunky 8", "ttf", NJ + "NotJamChunkySans8/NotJamChunky8.ttf", 6, "CC0", True),
    ("Cairopixel", "ttf", "itch-cairopixel-font/Cairopixel_Font_1_00-x/Cairopixel.ttf", 7, "OFL", True),
    ("Not Jam Serif 11", "ttf", NJ + "NotJamSerif11/NotJamSerif11.ttf", 7, "CC0", False),
    ("monogram italic", "ttf", "itch-monogram/monogram-extended-italic.ttf", 7, "CC0", True),
    ("Scientifica Italic", "bdf", "scientifica/scientifica/bdf/scientificaItalic-11.bdf", 7, "OFL", False),
    ("Not Jam Manuscript 8", "ttf", NJ + "NotJamMonoManuscript8/Not Jam Mono Manuscript 8.ttf", 7, "CC0", True),
    ("Not Jam Old Peculiar 8", "ttf", NJ + "NotJamMonoOldPeculiar8/Not Jam Mono Old Peculiar 8.ttf", 7, "CC0", True),
    ("Not Jam Prophet 8", "ttf", NJ + "NotJamMonoProphet8/Not Jam Mono Prophet 8.ttf", 7, "CC0", False),
    ("Not Jam Casual 10", "ttf", NJ + "NotJamMonoCasual10/Not Jam Mono Casual 10.ttf", 7, "CC0", False),
    ("Not Jam Crooked 8", "ttf", NJ + "NotJamMonoCrooked8/Not Jam Mono Crooked 8.ttf", 7, "CC0", False),
    ("Kenney Blocks", "ttf", KEN + "Kenney Blocks.ttf", 7, "CC0", False),
    ("Public Pixel", "ttf", "itch-publicpixel/Public_Pixel_Font_1_24-x/PublicPixel.ttf", 7, "CC0", False),
    ("m5x7", "ttf", "itch-m5x7/m5x7.ttf", 7, "CC0", False),
    ("Pixeloid Sans", "ttf", "itch-pixeloid-font/Pixeloid_Font_1_0-x/TrueType (.ttf)/PixeloidSans.ttf", 7, "OFL", False),
    ("Galmuri7", "bdf", "galmuri/Galmuri7.bdf", 7, "OFL", False),
    ("Kenney Pixel", "ttf", KEN + "Kenney Pixel.ttf", 7, "CC0", False),
    ("Spleen 5x8", "bdf", "spleen/spleen-5x8.bdf", 6, "BSD-2", False),
    ("Not Jam Slab Serif 11", "ttf", NJ + "NotJamSlabSerif11/NotJamSlabSerif11.ttf", 8, "CC0", False),
    ("Jacquarda Bastarda 9", "ttf", "gf-jacquardabastarda9/JacquardaBastarda9-Regular.ttf", 9, "OFL", False),
    ("Pixelbasel", "ttf", "itch-pixelbasel-font/Pixelbasel_Font_1_00-x/Pixelbasel.ttf", 9, "OFL", False),
    ("Not Jam Blackletter 13", "ttf", NJ + "NotJamBlackletter13/NotJamBlkltr13.ttf", 10, "CC0", False),
    ("Delta Block Italic", "ttf", "itch-deltablock/DeltaBlock_Font_1_0-x/TrueType (.ttf)/DeltaBlock-Italic.ttf", 10, "CC0", False),
    ("Jersey 10", "ttf", "gf-jersey10/Jersey10-Regular.ttf", 10, "OFL", False),
]


# The glyph a face's pixel grid is measured from, where its H has a flourish.
REF = {"Jacquarda Bastarda 9": "I"}


def ttf_grid(path, cap, ref="H"):
    """Each char's lit pixels as {(x, y)}, y up from the baseline, sampled at pixel centers."""
    f = TTFont(path)
    cmap, gs = f.getBestCmap(), f.getGlyphSet()

    def contours(name):
        pen = DecomposingRecordingPen(gs)
        gs[name].draw(pen)
        out, cur = [], []
        for op, args in pen.value:
            if op == "moveTo":
                cur = [args[0]]
            elif op in ("lineTo", "qCurveTo", "curveTo"):
                cur.extend(args)
            elif op in ("closePath", "endPath"):
                if cur:
                    out.append(cur)
                cur = []
        return out

    def inside(cs, x, y):
        n = 0
        for c in cs:
            for i in range(len(c)):
                (x1, y1), (x2, y2) = c[i], c[(i + 1) % len(c)]
                if y1 <= y < y2 and (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0:
                    n += 1
                elif y2 <= y < y1 and (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0:
                    n -= 1
        return n != 0

    hs = contours(cmap[ord(ref)])
    ys = [p[1] for c in hs for p in c]
    base, unit = min(ys), (max(ys) - min(ys)) / cap
    glyphs = {}
    for ch in CHARS:
        if ord(ch) not in cmap:
            continue
        name = cmap[ord(ch)]
        cs = contours(name)
        w = int(round(gs[name].width / unit)) + 2
        glyphs[ch] = {
            (x, y)
            for x in range(-1, w)
            for y in range(-4, cap + 3)
            if inside(cs, (x + 0.5) * unit, base + (y + 0.5) * unit)
        }
    return glyphs


def bdf_grid(path, cap):
    glyphs, cur, bits, bbx = {}, None, None, None
    for line in open(path, encoding="latin-1"):
        p = line.split()
        if not p:
            continue
        if p[0] == "ENCODING":
            cur = int(p[1])
        elif p[0] == "BBX":
            bbx = list(map(int, p[1:5]))
        elif p[0] == "BITMAP":
            bits = []
        elif p[0] == "ENDCHAR":
            if cur is not None and 0 <= cur < 128 and chr(cur) in CHARS:
                w, h, xo, yo = bbx
                glyphs[chr(cur)] = {
                    (xo + c, yo + h - 1 - r)
                    for r, (v, n) in enumerate(bits)
                    for c in range(w)
                    if (v >> (n - 1 - c)) & 1
                }
            bits = None
        elif bits is not None:
            bits.append((int(p[0], 16), len(p[0]) * 4))
    return glyphs


def gfx_grid(path, cap):
    src = open(path).read()
    bm = src[src.index("Bitmaps[]") :]
    bitmap = [int(x, 16) for x in re.findall(r"0x[0-9A-Fa-f]+", bm[bm.index("{") + 1 : bm.index("}")])]
    gl = src[src.index("Glyphs[]") :]
    gl = gl[gl.index("{") + 1 : gl.index("};")]
    table = [tuple(map(int, g)) for g in re.findall(r"\{\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\s*\}", gl)]
    first = int(re.findall(r"0x([0-9A-Fa-f]+),\s*0x[0-9A-Fa-f]+,\s*\d+\s*\}\s*;", src)[-1], 16)
    glyphs = {}
    for ch in CHARS:
        i = ord(ch) - first
        if not 0 <= i < len(table):
            continue
        off, w, h, _, xo, yo = table[i]
        lit = set()
        for k in range(w * h):
            if (bitmap[off + k // 8] >> (7 - k % 8)) & 1:
                r, c = divmod(k, w)
                lit.add((xo + c, -(yo + r) - 1))
        glyphs[ch] = lit
    return glyphs


def face_rows(glyphs, cap):
    """blinken rows: the charset's inked rows, descenders cut first past MAX_ROWS, centered in MAX_ROWS."""
    ys = [y for g in glyphs.values() for (_, y) in g]
    hi, lo = max(ys), min(ys)
    if hi - lo + 1 > MAX_ROWS:
        lo = max(lo, min(0, hi - MAX_ROWS + 1))
        hi = lo + MAX_ROWS - 1
    pad = MAX_ROWS - (hi - lo + 1)
    top = hi + pad // 2
    rows = MAX_ROWS
    out, width = {}, 0
    for ch, g in glyphs.items():
        xs = [x for (x, _) in g]
        x0, x1 = (min(xs), max(xs)) if xs else (0, 1)
        out[ch] = [
            "".join("#" if (x, y) in g else "." for x in range(x0, x1 + 1))
            for y in range(top, top - rows, -1)
        ]
        width = max(width, x1 - x0 + 1)
    clipped = sorted(ch for ch, g in glyphs.items() if any(y > top or y <= top - rows for (_, y) in g))
    return rows, width, out, clipped


READ = {"ttf": ttf_grid, "bdf": bdf_grid, "gfx": gfx_grid}
result = []
for name, kind, rel, cap, lic, pick in FACES:
    try:
        glyphs = READ[kind](f"{FONTS}/{rel}", cap, *([REF[name]] if name in REF else []))
    except Exception as e:  # noqa: BLE001 - a broken candidate is reported, not fatal
        print(f"{name}: failed ({e})")
        continue
    rows, width, table, clipped = face_rows(glyphs, cap)
    missing = [c for c in CHARS if c != " " and c not in glyphs]
    lit = {ch: sorted(g) for ch, g in glyphs.items()}
    result.append({"name": name, "license": lic, "pick": pick, "cap": cap, "rows": rows, "width": width, "glyphs": table, "lit": lit, "missing": missing, "clipped": clipped})
    print(f"{len(result):2d}/{len(FACES)} {name}: {rows} rows, {width} wide, missing {''.join(missing) or '-'}, clipped {''.join(clipped) or '-'}")

json.dump(result, open(OUT_JSON, "w"))

# Specimen: each face's name, then two lines of text in round lit dots on a dark board.
LINES = ["HELLO FROM BLITS!", "THE QUICK BROWN FOX & 0123456789 .,!?-:'*#"]
D, GAP_ROWS = 5, 3
LABEL_ROWS = 7
STANDARD = [
    ".###.#...##...##...######...##...##...#", "x",
]


def text_cols(face, text):
    cols = []
    for ch in text:
        g = face["glyphs"].get(ch)
        if ch == " " or g is None:
            cols.extend([["."] * face["rows"]] * max(2, face["width"] // 2 + 1))
            continue
        for x in range(len(g[0])):
            cols.append([g[y][x] for y in range(face["rows"])])
        cols.append(["."] * face["rows"])
    return cols


# A tiny 3x5 label font, drawn from Tom Thumb itself when present.
label_face = next((f for f in result if f["name"] == "Tom Thumb"), None)


def label_cols(text):
    if not label_face:
        return []
    return text_cols(label_face, text.upper())


# An optional fourth argument draws only the faces whose names contain it, comma-separated.
only = sys.argv[4].split(",") if len(sys.argv) > 4 else None
blocks = []
for face in [f for f in result if not only or any(o in f["name"] for o in only)]:
    tag = ("PICK - " if face["pick"] else "") + f"{face['name']} - {face['license']}"
    blocks.append(("pick" if face["pick"] else "label", label_cols(tag), label_face["rows"] if label_face else 0))
    for line in LINES:
        blocks.append(("text", text_cols(face, line), face["rows"]))
    blocks.append(("gap", [], GAP_ROWS))

W = max(len(b[1]) for b in blocks) + 4
H = sum(r + 1 for (_, _, r) in blocks) + 4
px_w, px_h = W * D, H * D
img = bytearray([18, 14, 10] * px_w * px_h)


def dot(cx, cy, color):
    r = D * 0.42
    for yy in range(int(cy - r), int(cy + r) + 1):
        for xx in range(int(cx - r), int(cx + r) + 1):
            if 0 <= xx < px_w and 0 <= yy < px_h and (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r:
                i = (yy * px_w + xx) * 3
                img[i : i + 3] = bytes(color)


row = 2
for kind, cols, rows in blocks:
    for x, col in enumerate(cols):
        for y in range(rows):
            lit = col[y] == "#"
            color = (255, 154, 46) if kind == "text" and lit else (90, 255, 110) if kind == "pick" and lit else (120, 190, 255) if lit else (40, 32, 26)
            if kind == "text" or lit:
                dot((x + 2.5) * D, (row + y + 0.5) * D, color)
    row += rows + 1

raw = b"".join(b"\x00" + bytes(img[y * px_w * 3 : (y + 1) * px_w * 3]) for y in range(px_h))


def chunk(t, data):
    c = struct.pack(">I", len(data)) + t + data
    return c + struct.pack(">I", zlib.crc32(t + data) & 0xFFFFFFFF)


with open(OUT_PNG, "wb") as f:
    f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", px_w, px_h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
print(f"specimen {px_w}x{px_h} -> {OUT_PNG}")
