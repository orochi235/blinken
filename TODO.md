# TODO

## Rename to blinken

Decided 2026-11-05: bree becomes `blinken` (free on npm). Covers the package name, the `bree:` error prefixes, the `bree_` WGSL helpers, page titles, and storage keys (old drafts migrated on read). The GitHub repo becomes orochi235/blinken and the site moves to michaelbaker.tech/blinken/; the old /bree/ path may 404. `~/src/bree` and `~/src/bree-gpu` get renamed once no session is in them. The code rename waits for the `player` branch (in `~/src/bree-gpu`) to merge, so it isn't rebased over a sweeping rename (2026-11-05).

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
- GPU paths missing tests: device loss drawing nothing, highlight clamping, live resize, the RGBA8 fallback (where `EXT_color_buffer_float` is missing), a layer cued on a gpu mix, and partial weight, params-while-off and seek-past-loop for a layer cued only while on (2026-11-04).
- `BLITS=npm node test/gpu/run.mjs` still bundles the sibling blits checkout: esbuild follows `tsconfig.json`'s `paths`, which list `../blits/src` first, so emptying the alias map changes nothing. The runner needs a tsconfig without those paths in npm mode (2026-11-04).
- The shaders compare f32 values at thresholds in `tile`, `neon` and `glitch`, so a dot within one f32 step of a boundary can disagree with the CPU for a frame; sampled times showed none. The WebGPU flicker step loses whole steps after hours of clock (2026-11-04).
- The WebGL blur's taps are `max(1, 3σ/16)` texels apart, so at a large pitch times pixel ratio (around 120 device pixels) it may band; not measured (2026-11-04).
- The gather shader hardcodes 7 channels and the `USES` table repeats the WGSL bindings, so a new channel or binding has to be added in two places that nothing checks agree (2026-11-04).
- WebGPU allocates every frame (the `cpuChannels` Set, the `planOf` array, `only()`, `paintBulbs`'s spread), which is garbage the 2D and WebGL paths don't make (2026-11-04).
- Every marquee statically imports the GPU modules, so a page that never draws with WebGPU still downloads them (2026-11-04).
- A WebGL sign made on a shed canvas while no context slot is free is `dark()` (`src/render/webgl/sign.ts`) and never retries, so it stays blank after another sign frees a slot (2026-11-04).
- No test covers `repaint` or `setHighlight` going through `prepare`, so a change there that drops a frame would pass (2026-11-04).
- Where WebGPU is absent the lab shows a disabled "webgpu" option as selected, and its WebGL and 2D choices wait on `gpu()` at startup (2026-11-04).

## Known gaps

- On `grid: 'triangles'`, the `reel-in` move spins letters rasterized without doubling, so they show half width; it reads glyphs through `rasterize` rather than `placeText`'s `lookOn` (2026-11-04).
- The `strokes` face samples each glyph as if it starts on an up-pointing triangle; text placed at an odd column or row draws each triangle flipped, which roughens its strokes, and a scroll by one place shows it every other step (2026-11-04).
- The triangle grid draws no seams between its hexagons: they only describe the tiling. Other tilings (squares cut into four, say) would each be a `triangleAt` of their own (2026-11-04).

- On the effects page in a window 1200px wide or less, the diagram and the card designer still share one scrolling column, so picking a node scrolls its card into view and carries the diagram off screen; wider, the designer has a column of its own (2026-11-01).
- Duplicate copies ship in `WEASEL=npm` runs and the deployed lab: `@msb235/blits-panel@0.4.1` pins weasel `1.12.0` exactly, so npm nests weasel 1.12 under it beside bree's 1.15, and each weasel pins its own blits (1.15 → `0.12.0`, 1.12 → `0.11.0`) beside bree's `0.16.1`. Needs a blits-panel release on current weasel, and weasel taking blits as a range (2026-11-01).
- `wave` on a 7-row sign clips a letter's top or bottom row at each step, since the font leaves no spare rows; it reads cleanly from 9 rows up.
- `swarm` on a message about as wide as the sign fills it with in-flight dots, so the scatter reads as a haze rather than separate dots.
- Compose's store (`lab/compose/store.ts`, `attach`/`seek`/`setRate`) and the effects preview (`lab/effects/preview.ts`) each carry a sign's rate, hold and position over to the sign that replaces it, in two copies that can drift. One helper both build on would fold them; the store keeps its copy in `import.meta.hot.data`, which the helper has to survive (2026-11-01).
