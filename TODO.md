# TODO

## Parked

- Authoring an effect's params in the designer: naming a param and picking the settings it changes. Parked 2026-10-24 as more than the lab needs for now; effects declare params in code, as the built-ins do. The section as built is in e294d8a (`lab/compose/designer/ParamsBox.tsx`).

## GPU renderers

What the GPU work left, from the branch's last session (2026-11-04). The design and measurements are in `docs/gpu-renderers.md`.

- Spreads by letter or at random stay on the CPU on WebGPU: `src/pieces.ts` cues a move's order as an unnamed stagger function over a finite span, which blits keeps on the CPU, and takes a move's shader form only at span 0. blits 1.0 folds a named stagger, or a looping one, on the GPU, so moving them over means naming the stagger and letting shader moves take one. Spreads by column, row or from the center already fold, as closed-form ranks. The built-in `neon` layer is spread by letter, so it is one of them (2026-11-04).
- Modulators not ported: `dim`, `desaturate` and `flare` ease with CSS cubic-beziers, and a shader needs a WGSL copy of blits's easing, which blits keeps private. Moves not ported: `reel-in` spins letters through glyphs rasterized on the CPU; `melt`, `assemble` and `scatter` push each lit dot to a moving place, which has no closed form per output dot. They run on the CPU on every backend (2026-11-04).
- The lab's thumbnails and slider readouts are pinned to 2D: about 90 canvases on the compose page exhaust WebGL's 12 contexts and starve the main sign. Segment readouts now share one surface (`docs/readouts.md`), but a whole marquee can't join one yet: a surface lays out readouts, not marquee boards, programs and layers (2026-11-04).
- Segment readouts take no effects: segments are mix subjects and a cued layer reaches them (`test/readout-surface.test.ts`), but no readout option cues one (2026-11-04).
- Nixie front wires don't darken the lit numeral where they cross it, as a real tube's do; unlit wires draw only as hairlines in the housing, behind it (2026-11-04).
- An overlay reads every followed element's `getBoundingClientRect` each frame and runs the optics for readouts that are off screen; with hundreds of readouts, layout reads and hidden lights both cost (not measured, 2026-11-04).
- Segment materials beside LED: Numitron (glowing filaments), flip segments (reflective faces flipped by a magnet) and VFD (blue-green phosphor behind a grid). `src/render/lights.ts`'s `Material` is where they'd go (2026-11-04).
- Custom LCD types, cut from characters the way custom LCD glass is designed: draw a set of characters (a web font's, or SVG paths) over one another in one cell, label each pixel with the characters covering it, and make each connected run of one label a segment; a character then lights exactly the segments whose labels include it. Segments under a minimum area merge into the neighbor sharing their longest edge, at a cost per character the cut should report, and a gap shrinks each so they read apart. Each segment is an irregular filled region, which needs a primitive the renderers don't have yet (a distance-field atlas, say; Nixie cathodes are polylines, `docs/readouts.md`); the result is an ordinary display type. Wanted with a lab page to pick the font and characters and see the cut, the segment count and the losses. Kept out of the readouts build (2026-11-04).
- GPU paths missing tests: the RGBA8 fallback (where `EXT_color_buffer_float` is missing), a layer cued on a gpu mix, and partial weight, params-while-off and seek-past-loop for a layer cued only while on (2026-11-04).
- The shaders compare f32 values at thresholds in `tile`, `neon` and `glitch`, so a dot within one f32 step of a boundary can disagree with the CPU for a frame; sampled times showed none. The WebGPU flicker step loses whole steps after hours of clock (2026-11-04).
- The WebGL blur's taps are `max(1, 3σ/16)` texels apart, so at a large pitch times pixel ratio (around 120 device pixels) it may band; not measured (2026-11-04).
- Every marquee statically imports the GPU modules, so a page that never draws with WebGPU still downloads them: `src/render/webgpu` is 25.5 KB of the 544 KB minified bundle (measured with esbuild's metafile, 2026-11-05); blits's GPU engine, another 59 KB, stays either way, since the built-in effects import `shaderPatch` and a mix takes its engine when made. Splitting it off means `gpu()` loading the module, so a handle built by hand needs a loader call too, or a WebGPU sign that draws nothing until its module lands (2026-11-04).

## Known gaps

- Over a white page, a lit dot's pale core and its glow read as pastel rather than as the saturated light it shows over black: the core is white light, which a white page can't show. The unlit sockets were made to read alike on both (`veil` in `src/render/housing.ts`); the lit dots weren't (2026-11-05).

- `test/gpu/readouts.gpu.ts`'s "a faceplate is dark" fails on all three backends: readout surfaces draw with `housing: 'clear'`, which since fffdb50 makes the faceplate a veil (alpha 7/255) like every other socket, and `test/housing.test.ts` asserts that. `ReadoutOptions.face` still documents `'plate'` as "a dark faceplate". Either the plate stays opaque on a clear housing or the doc and GPU test change (2026-11-05).
- `npm run smoke`'s `stretched` page (a 320 × 63 sign, 20,550 lights) draws at 2–3 fps headless on studio, though its mix and draw report about 54 ms a frame together; where the rest of each frame goes isn't measured (2026-11-05).
- `dim` and `desaturate` change once and stay changed, so looped they snap back at each repeat; every other looping effect closes its loop, which `test/loop-seams.test.ts` holds at each setting's least and most. Making these two seamless means changing what they are: going there and back, or holding the end instead of repeating (2026-11-05).
- `<blinken-player>` carries the whole runtime, about 195 KB gzipped, whatever its program uses (`docs/player.md`) (2026-11-04).

- The `strokes` face samples each glyph as if it starts on an up-pointing triangle; text placed at an odd column or row draws each triangle flipped, which roughens its strokes, and a scroll by one place shows it every other step (2026-11-04).
- The triangle grid draws no seams between its hexagons: they only describe the tiling. Other tilings (squares cut into four, say) would each be a `triangleAt` of their own (2026-11-04).

- On the effects page in a window 1200px wide or less, the diagram and the card designer still share one scrolling column, so picking a node scrolls its card into view and carries the diagram off screen; wider, the designer has a column of its own (2026-11-01).
- Duplicate blits copies ship in `WEASEL=npm` runs and the deployed lab: weasel `1.16.1` (`core`, `animator`) pins `@msb235/blits@0.16.1` exactly, so npm nests it beside blinken's 1.0.0. Needs weasel taking blits as a range (2026-11-05).
- The default fade's 110 ms fall outlasts `scroll`'s default 45 ms column, so a scrolling message trails two or three columns of afterglow that fill the gaps between letters; at small pitches it reads as a lit band with dark letters. The portfolio tile sets `fade: { fall: 35 }`. Either default could change, or `scroll` could ask for a shorter fall while it plays (2026-11-05).
- `wave` on a 7-row sign clips a letter's top or bottom row at each step, since the font leaves no spare rows; it reads cleanly from 9 rows up.
- `swarm` on a message about as wide as the sign fills it with in-flight dots, so the scatter reads as a haze rather than separate dots.
