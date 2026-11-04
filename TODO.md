# TODO

## Parked

- Authoring an effect's params in the designer: naming a param and picking the settings it changes. Parked 2026-10-24 as more than the lab needs for now; effects declare params in code, as the built-ins do. The section as built is in e294d8a (`lab/compose/designer/ParamsBox.tsx`).

## GPU renderers

What the GPU work left, from the branch's last session (2026-11-04). The design and measurements are in `docs/gpu-renderers.md`.

- Ranked, letter and random spreads stay on the CPU: they need blits's staggered voices (its phase 2). The built-in `neon` layer is spread by letter, so it is one of them (2026-11-04).
- Scene moves and layers are held by the program's and scene's owners, and sign layers' weights are signals (`level`), none of which blits folds on the GPU until its phase 3. Until then `lit` is computed on the CPU even on WebGPU, which is why WebGPU's mix costs more than WebGL's at 20,000 lights and up (2026-11-04).
- Round 2 of the benchmark once blits phase 3 lands: `npm run bench` (`scripts/bench.mjs`) on a quiet fleet node, compared with round 1 in `docs/gpu-renderers.md`, which also holds the one candidate left (staging plain patches on WebGPU, about 40% off its mix) (2026-11-04).
- Modulators not ported: `dim`, `desaturate` and `flare` ease with CSS cubic-beziers, and a shader needs a WGSL copy of blits's easing, which blits keeps private. Moves not ported: `reel-in` spins letters through glyphs rasterized on the CPU; `melt`, `assemble` and `scatter` push each lit dot to a moving place, which has no closed form per output dot. They run on the CPU on every backend (2026-11-04).
- The lab's thumbnails and slider readouts are pinned to 2D: about 90 canvases on the compose page exhaust WebGL's 12 contexts and starve the main sign. Many small displays on one page need a shared drawing surface, which the 7-segment display project decides (2026-11-04).
- 7-segment displays, the next design: a page holds hundreds of digits, so whether WebGPU takes that many canvases or they share one surface decides its layout. The shape table and the material seam (`src/render/lights.ts`) are where its shapes and materials go (2026-11-04).
- GPU paths missing tests: device loss drawing nothing, highlight clamping, live resize, the RGBA8 fallback (where `EXT_color_buffer_float` is missing), a layer cued on a gpu mix, and partial weight, params-while-off and seek-past-loop for a layer cued only while on (2026-11-04).
- The shaders compare f32 values at thresholds in `tile`, `neon` and `glitch`, so a dot within one f32 step of a boundary can disagree with the CPU for a frame; sampled times showed none. The WebGPU flicker step loses whole steps after hours of clock (2026-11-04).
- The WebGL blur's taps are `max(1, 3σ/16)` texels apart, so at a large pitch times pixel ratio (around 120 device pixels) it may band; not measured (2026-11-04).
- Not released: the branch needs blits main commits `bddfb8d` (angle in WGSL), `b269ec9` (shader tables) and `1919a94` (weight-0 voices don't block the GPU), unreleased as of 2026-11-04. On npm blits 0.20 the code runs and falls back to the CPU for those channels.

## Known gaps

- On the effects page in a window 1200px wide or less, the diagram and the card designer still share one scrolling column, so picking a node scrolls its card into view and carries the diagram off screen; wider, the designer has a column of its own (2026-11-01).
- Duplicate copies ship in `WEASEL=npm` runs and the deployed lab: `@msb235/blits-panel@0.4.1` pins weasel `1.12.0` exactly, so npm nests weasel 1.12 under it beside bree's 1.15, and each weasel pins its own blits (1.15 → `0.12.0`, 1.12 → `0.11.0`) beside bree's `0.16.1`. Needs a blits-panel release on current weasel, and weasel taking blits as a range (2026-11-01).
- `wave` on a 7-row sign clips a letter's top or bottom row at each step, since the font leaves no spare rows; it reads cleanly from 9 rows up.
- `swarm` on a message about as wide as the sign fills it with in-flight dots, so the scatter reads as a haze rather than separate dots.
- Compose's store (`lab/compose/store.ts`, `attach`/`seek`/`setRate`) and the effects preview (`lab/effects/preview.ts`) each carry a sign's rate, hold and position over to the sign that replaces it, in two copies that can drift. One helper both build on would fold them; the store keeps its copy in `import.meta.hot.data`, which the helper has to survive (2026-11-01).
