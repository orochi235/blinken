# Segment Readouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: written 2026-11-04, being built on `gpu-renderers`.** Delete this file when the last task lands.

**Goal:** Segment readouts (7-segment through Nixie and the notation types) drawn by bree's three backends, many to one canvas, as a panel or a page overlay.

**Architecture:** Optics stay as they are. A surface's segments are the dots of a synthetic `Board` laid out in bands (one band of rows per readout, a row per slot, a column per cell), so optics, defects, ghosts, gather and the mix all work unchanged. What changes is drawing. Every backend draws a **primitive table** (discs, bars, polylines, plates) through per-view transforms instead of one disc per light at a grid place. The marquee becomes one view of disc primitives.

**Tech Stack:** TypeScript, WebGPU (WGSL), WebGL 2 (GLSL ES 3.0), Canvas 2D, `@msb235/blits` 1.0 (`mix`, `shaderPatch` with tables), vitest, the `test/gpu` Playwright runner.

**Spec:** `docs/superpowers/specs/2026-11-04-segment-readouts-design.md`

## Global Constraints

- Published source (`src/`) keeps relative imports; lab and tests use `@/`.
- No source file past a few hundred lines; split by responsibility.
- Each shader with a TS twin gets an agreement test; GPU-only checks live in `test/gpu/*.gpu.ts`, run by `npm run test:gpu`.
- Every `onto` job passes `--kind`; full suites go to the fleet (`onto test`, or `onto do -alone --kind test`), never run locally. A single test file under ~10 s may run locally.
- US English, sparse comments, no inline styles, no `!important`.
- Commit subjects are imperative and end with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` line.

## Decisions taken while planning (2026-11-04)

These revise the spec. Task 12 writes them into it.

- **Banded board.** A surface's lights are `board(cols = most cells of any readout, rows = sum of each readout's slot count, border = false)`. Readout `r` owns rows `[base_r, base_r + slots_r)` and columns `[0, cells_r)`. A segment is the dot at `x = cell`, `y = base_r + slot`. Grid places a readout doesn't fill are phantom dots: they have no primitives, so nothing draws them. As a result:
  - `ghost` is a surface option, not a readout option. `ghost.row` leaks along a segment line (the same slot across a readout's digits), which is the realistic multiplex leak. `ghost.col` leaks down a column of the board and so crosses readouts.
  - Defects stay per readout. A readout maps `{ cell, slot }` to the surface's `{ x, y }`.
  - The mix fields are a segment's `x = cell` and `y = band row`.
- **Polylines replace the distance-field atlas.** A Nixie cathode is a polyline primitive whose distance the shaders compute exactly from a points buffer. No texture atlas is built; the custom-LCD TODO now owns the atlas.
- **The colon is a light in every `seven` cell** (two discs at the cell's right edge), lit by a `:` after that cell's character. The layout never depends on the value.
- **No Nixie wire occlusion.** Unlit wires draw as hairline sockets behind the lit numeral. The darkening where front wires cross a lit one is not built; Task 12 files it in `TODO.md`.

## Review Focus

- **The marquee must look the same as before.** Moving dots onto primitives must not change a pixel beyond rounding. The existing `test/gpu/webgl.gpu.ts` and `webgpu.gpu.ts` "matches 2D" checks and `test/draw.test.ts` must pass unchanged; Task 3 adds a check that the 2D marquee's drawn discs match the old radius formula.
- **A readout whose element scrolls out of a scrolling pane** must stop drawing at the pane's edge, not at the viewport's (Task 9 test).
- **A value with characters the type lacks, or too long for the readout,** shows blanks for unknown characters, and the last cells (numbers) or the first cells (text). It never throws (Task 6 test).
- **Adding and removing readouts while running** keeps the other readouts' values and draws no stale lights (Task 8 test).
- **WebGL with no free context.** A surface on WebGL falls back to 2D the way a marquee does (Task 8 uses `attach`, so this is inherited; Task 8 test asserts `backend` is `'2d'` when `webglSlot()` is exhausted).

---

### Task 1: Primitive table and its distance function

**Files:**
- Create: `src/render/prims.ts`
- Modify: `src/render/lights.ts` (keep `LAMP_SIZE`, `LED`, `Material`, `radiusOf`; replace `LightTable`/`lightTable` with `boardPrims`)
- Test: `test/prims.test.ts` (replaces `test/lights.test.ts`'s table checks)

**Interfaces — Produces:**
```ts
export const PRIM = { disc: 0, bar: 1, poly: 2, plate: 3 } as const;
export const ENDS = { point: 0, round: 1, square: 2 } as const;
export const SOCKET = { none: 0, dot: 1, bulb: 2, segment: 3, wire: 4, plate: 5 } as const;
export const GEOM = 8; // floats per primitive
export interface Prims {
  readonly n: number;
  readonly light: Uint32Array;   // owning light; NO_LIGHT for plates
  readonly view: Uint32Array;    // transform index
  readonly kind: Uint32Array;    // PRIM
  readonly socket: Uint32Array;  // SOCKET
  readonly geom: Float32Array;   // GEOM per prim, local units, see below
  readonly points: Float32Array; // x,y pairs for polylines
}
export const NO_LIGHT = 0xffffffff;
// geom: disc  [cx, cy, r, lampScaled(0|1), glow, 0, 0, 0]
//       bar   [x1, y1, x2, y2, halfWidth, ends, glow, 0]
//       poly  [first, count, halfWidth, glow, minX, minY, maxX, maxY]  (first/count index point pairs)
//       plate [x0, y0, x1, y1, cornerRadius, 0, 0, 0]
export interface PrimBuilder { disc(...); bar(...); poly(...); plate(...); build(): Prims }
export function primBuilder(): PrimBuilder;
export function sdf(p: Prims, k: number, x: number, y: number, lamp: number): number; // local units, <0 inside
export function radiusOfPrim(p: Prims, k: number, lamp: number): number; // disc r (×lamp if scaled), bar/poly halfWidth, plate 0
export function reachOf(p: Prims, k: number, lamp: number): { x0: number; y0: number; x1: number; y1: number }; // local bbox
export function boardPrims(b: Board, leds: readonly Led[], grid: Grid): { prims: Prims; frame: { left: number; top: number; across: number; down: number } };
```
Disc radius for the marquee is `radiusOf(kind)`, `lampScaled = 1`, socket `dot`/`bulb`, view 0. Its place is `grid(x, y) - (left, top)` as `lightTable` computed.

`ENDS.point` bar: a hexagonal bar. Its distance is `max(|across| - halfWidth, |along| + |across| - (halfLength + halfWidth))` in the bar's frame, so its ends taper at 45° to a point. `round` is a capsule; `square` is a box.

- [ ] Step 1: Write `test/prims.test.ts`:
  - `sdf` of a disc at its center is `-r`, and on its rim is 0.
  - `sdf` of a bar on its axis midpoint is `-halfWidth`. Past a round end by `d` it is `d`; past a square end it is the box distance.
  - The `point` end's tip is 0 at `halfLength + halfWidth` along the axis.
  - A poly's sdf is the minimum over its segments minus `halfWidth`.
  - A plate's is the rounded-box distance.
  - `boardPrims(board(5, 3), …)` gives one disc per led, at the places `lightTable` gave (copy the old expectations from `test/lights.test.ts`), with `lampScaled = 1`.
- [ ] Step 2: Run `npx vitest run test/prims.test.ts` and confirm it fails.
- [ ] Step 3: Implement `src/render/prims.ts` and `boardPrims`; delete `lightTable`/`LightTable` and fix their importers in later tasks (Tasks 3–5 own those files).
- [ ] Step 4: Run it again and confirm it passes.
- [ ] Step 5: Commit: `add a primitive table of discs, bars, polylines and plates with a distance function`.

### Task 2: Placement, view transforms and the marquee's fit

**Files:**
- Create: `src/render/placement.ts`
- Test: `test/placement.test.ts`

**Interfaces — Produces:**
```ts
export const VIEW = 8; // floats per view
// view: [ox, oy, scale, slant, clipX0, clipY0, clipX1, clipY1], device px; local (x, y) -> (ox + (x - y*slant)*scale, oy + y*scale)
export interface Placement {
  readonly views: Float32Array;
  /** Device px per local unit of view 0, for the marquee's blur; 0 where a surface has no single pitch. */
  readonly pitch: number;
  /** Whether a full-canvas blur blooms the glow (marquee) or each primitive's own Gaussian does (surface). */
  readonly blur: boolean;
  /** Starts sizing `canvas`; `changed` runs after every resize or view change. Returns stop. */
  start(canvas: HTMLCanvasElement, changed: () => void): () => void;
  /** Called each frame before drawing; true when views moved since the last call (housing repaints). */
  update(): boolean;
  /** Re-fits now (lamps.pitch changed). */
  refit(): void;
}
export function boardPlacement(
  frame: { left: number; top: number; across: number; down: number },
  want: () => number | undefined,
): Placement; // wraps fitCanvas; view 0 = (-left*pitch, -top*pitch, pitch, 0, 0,0,w,h)
export function toDevice(views: Float32Array, v: number, x: number, y: number): [number, number];
```

- [ ] Step 1: Write `test/placement.test.ts`:
  - `toDevice` applies offset, scale and slant as above.
  - `boardPlacement` on a stubbed `fitCanvas` pitch of 10 sets view 0 to `[-left*10, -top*10, 10, 0, 0, 0, w, h]`. Mock the canvas and parent as `test/draw.test.ts` does.
- [ ] Step 2: Run it and confirm it fails. Step 3: Implement. Step 4: Run it and confirm it passes.
- [ ] Step 5: Commit: `add view placements, the marquee's fitted to its parent`.

### Task 3: 2D sign draws primitives

**Files:**
- Modify: `src/draw.ts` (split: move the per-primitive path drawing to `src/render/paint2d.ts`)
- Create: `src/render/paint2d.ts`, `src/render/sign-lights.ts`
- Test: `test/draw.test.ts`, `test/paint2d.test.ts`

**Interfaces:**
- Consumes: Task 1 `Prims`, `sdf`; Task 2 `Placement`.
- Produces:
```ts
// src/render/sign-lights.ts
export interface SignLights {
  readonly board: Board;           // optics
  readonly leds: readonly Led[];   // light order = optics order
  readonly prims: Prims;
  readonly placement: Placement;
}
export function boardLights(b: Board, leds: readonly Led[], grid: Grid, want: () => number | undefined): SignLights;
// Sign gains:
reshape(next: SignLights): void; // swaps lights; keeps fade/ghost/lamps; defects reset to []
```
`createSign(canvas, lights: SignLights, backed)` replaces `(canvas, b, leds, backed, grid)`; `attach` and `createMarquee` pass `boardLights(...)`. In `paint2d.ts`, `pathOf(ctx, prims, k, views, lamp)` traces a primitive in device px: discs as arcs, bars as polygons (hexagon for `point`, a capsule built from arcs for `round`, a rect for `square`), polylines stroked with round caps and joins at `2*halfWidth`, plates as round rects. Every light's primitives draw what it shows. Sockets paint per `SOCKET` color (`DOT_COLOR`, `BULB_COLOR`, new `SEGMENT_COLOR = 0x1c130d`, `WIRE_COLOR = 0x2a221c` at a hairline of 0.15× the stroke width, `PLATE_COLOR = HOUSING`). Each view clips to its clip rect. With `placement.blur` false there is no `filter: blur`, and the glow pass draws each primitive's path at its halo width with a `shadowBlur` of the halo radius instead.
- [ ] Step 1: Add to `test/draw.test.ts`: a 2D marquee sign on a recording context draws, for a lit dot, an arc of radius `pitch * LAMP_SIZE * radiusOf('dot')` at the old place (the Review Focus check). Add to `test/paint2d.test.ts`: `pathOf` for a `point` bar emits six `lineTo`s, and a poly emits `count - 1` segments.
- [ ] Step 2: Run both and confirm they fail. Step 3: Implement. Step 4: Run `npx vitest run test/draw.test.ts test/paint2d.test.ts test/marquee.test.ts test/thumbnail.test.ts` and confirm they pass.
- [ ] Step 5: Commit: `draw the 2D sign from primitives through placed views`.

### Task 4: WebGL sign draws primitives

**Files:**
- Modify: `src/render/webgl/glsl.ts` (split the SDF into `src/render/webgl/glsl-sdf.ts`), `src/render/webgl/gl.ts`, `src/render/webgl/sign.ts`
- Test: `test/gpu/webgl.gpu.ts`, `test/gpu/sdf.gpu.ts` (new)

**Interfaces:** Consumes `SignLights`. `createWebGlSign(canvas, lights, backed)`; `reshape` rebuilds resources on the same context.
- Instance per primitive. Per-instance static attributes: `geom` (two vec4), `kind/light/view/socket` (uvec4).
- Per-light shows go in an `RGBA32F` texture of `n × 2` texels, read with `texelFetch` by `light`, since several primitives share a light. Views go in an `RGBA32F` texture of `views × 2` texels; points in an `RG32F` texture.
- Vertex shader: transform the primitive's local bbox (grown by reach, for glow) to device px with its view; pass the local coordinate.
- Fragment shader: `sdf` in local units × view scale = device px. Coverage `1 - smoothstep(-0.5, 0.5, d)`. Discard outside the view's clip rect.
- Glow: `peak * exp(-(max(d + r, 0))² / (2σ²))`, the existing disc formula generalized. Body: color with a core where `d + r < r*core`.
- The full-canvas blur runs only when `placement.blur`.
- [ ] Step 1: `test/gpu/sdf.gpu.ts` renders each primitive kind's distance to a float target in WebGL and compares it to TS `sdf` on sampled points: worst ≤ 1e-3 local units. Existing `webgl.gpu.ts` "matches 2D" tests stay as they are.
- [ ] Step 2: Run `onto do -alone --kind test --task bree-readouts-webgl --expect 5m -- sh -c 'npm ci >/dev/null 2>&1; npm run test:gpu'` and confirm the new test fails. Step 3: Implement. Step 4: The same job passes.
- [ ] Step 5: Commit: `draw the WebGL sign from primitives through placed views`.

### Task 5: WebGPU sign draws primitives

**Files:**
- Modify: `src/render/webgpu/wgsl-draw.ts` (SDF into `src/render/webgpu/wgsl-sdf.ts`), `src/render/webgpu/pipelines.ts`, `src/render/webgpu/sign.ts`
- Test: `test/gpu/sdf.gpu.ts` (WGSL half), `test/gpu/webgpu.gpu.ts`

Mirrors Task 4. The storage buffers are `prims` (`GEOM` floats + 4 u32 per primitive), `views`, `points`; the instance index is the primitive. The housing repaints when `placement.update()` returns true. `createWebGpuSign(canvas, lights, handle, source, backed)`; `reshape` rebuilds painter, optics and sources on the same configured context. Sources and optics keep taking `board` and `leds` from `SignLights`.
- [ ] Steps 1–5 as Task 4, WGSL against TS `sdf`. Commit: `draw the WebGPU sign from primitives through placed views`.

### Task 6: Display types: model, encoders and the bar-segment family

**Files:**
- Create: `src/readout/type.ts` (model, encoder helpers), `src/readout/types/segments.ts` (`seven`, `eight`, `nine`, `half`), `src/readout/types/alpha.ts` (`fourteen`, `sixteen`, `twentytwo`), `src/readout/types/index.ts` (`TYPES` registry)
- Test: `test/readout-types.test.ts`

**Interfaces — Produces:**
```ts
export type SegShape =
  | { kind: 'disc'; x: number; y: number; r: number }
  | { kind: 'bar'; x1: number; y1: number; x2: number; y2: number; w: number }
  | { kind: 'poly'; points: readonly (readonly [number, number])[]; w: number };
export interface SegLight { readonly name: string; readonly shapes: readonly SegShape[] } // slot = index in cell.lights
export interface DisplayType {
  readonly name: TypeName;
  readonly cell: { readonly width: number; readonly height: number; readonly lights: readonly SegLight[] };
  readonly gap: number;          // between cells, cell units
  readonly ends: keyof typeof ENDS;
  readonly socket: 'segment' | 'wire';
  readonly glow: number;         // per-primitive glow multiplier (Nixie 2.5, others 1)
  readonly align: 'left' | 'right';
  /** Lit light names per cell, `cells` long. */
  encode(value: string | number, cells: number, align: 'left' | 'right'): ReadonlySet<string>[];
}
export type TypeName = 'seven' | 'eight' | 'nine' | 'half' | 'fourteen' | 'sixteen' | 'twentytwo' | 'nixie' | 'cistercian' | 'matrix' | 'maya' | 'kaktovik' | 'rods' | 'braille' | 'ogham' | 'morse' | 'semaphore' | 'dice' | 'tally' | 'bcd' | 'bargraph';
export const TYPES: Readonly<Record<TypeName, DisplayType>>;
export function textEncoder(table: Readonly<Record<string, string>>, opts: { dp?: string; colon?: string; comma?: string }): DisplayType['encode']; // table: char -> space-separated light names
```
Cell unit: `seven` is 10 wide by 18 tall, as in the mockup (`a:[2,1,8,1] … g:[2,9,8,9]`, DP disc at (10.6, 17), colon discs at (11.2, 6) and (11.2, 12)), bar `w` 1.4. Standard character sets: `seven` maps 0–9, A–F, the letters 7-segment conventionally shows (b c d E F G H I J L n o P r S t U y), `-`, `_`, `=`, `°` and space. `fourteen` and `sixteen` take A–Z, 0–9 and ASCII punctuation, the standard way; `twentytwo` adds a–z with descenders. `half` lights `1`, `-`, or both.
- [ ] Step 1: Write `test/readout-types.test.ts`:
  - `seven.encode('12:34', 4, 'right')` lights `b c` / `a b g e d` plus `colon` / `a b g c d` / `f g b c`.
  - `seven.encode('1.5', 2, …)` puts `dp` on the first cell.
  - An unknown char is an empty set.
  - `encode(123456, 4, 'right')` shows `3456`; `encode('HELLO', 3, 'left')` shows `HEL`.
  - Every `fourteen` A–Z set is non-empty, and the sets for distinct letters differ.
  - Every type's light names are unique within its cell.
- [ ] Step 2: Fails. Step 3: Implement. Step 4: Passes.
- [ ] Step 5: Commit: `add 7-, 8-, 9-, 14-, 16- and 22-segment display types and the half digit`.

### Task 7: Display types: Nixie and the notations

**Files:**
- Create: `src/readout/types/nixie.ts`, `src/readout/types/numerals.ts` (`cistercian`, `maya`, `kaktovik`, `rods`), `src/readout/types/scripts.ts` (`braille`, `ogham`, `morse`, `semaphore`), `src/readout/types/counts.ts` (`dice`, `tally`, `bcd`, `bargraph`), `src/readout/types/matrix.ts` (`matrix`, from `src/font.ts`'s 5×7 face)
- Test: `test/readout-notations.test.ts`

Consumes Task 6's `DisplayType`, `SegShape` and `textEncoder`. Geometry starts from the mockup in `.superpowers/brainstorm/51653-1793823017/content/display-types-v2.html`.
- **Nixie:** ten lights, `0`–`9`, each one `poly` traced as smooth single strokes (arcs sampled at ≤ 6° steps) in a 12 × 20 cell. Lights are ordered back to front `1 6 2 7 5 0 4 9 8 3`. `socket: 'wire'`, `glow: 2.5`, `ends: 'round'`.
- **Number types** take numbers. `cistercian` packs 4 places per cell, 0–9999. `maya` and `kaktovik` write base 20, most significant cell first. `rods` alternate upright (units, hundreds) and lying (tens, thousands). `dice` shows 0–9 with nine pips. `tally` fills gates of five, one gate per cell. `bcd` has 4 lamps per digit.
- **`bargraph`** takes 0–1 and lights `round(v * bars)` bars, with one bar per cell.
- **Scripts:** `braille` covers Grade 1 a–z, 0–9 (with the number sign) and space. `morse` uses International Morse, a cell per character, 5 places of a dot or a dash. `semaphore` uses the standard flag alphabet. `ogham` takes the 20 letters, plus `stem` lit in every non-blank cell.
- [ ] Step 1: Write `test/readout-notations.test.ts`:
  - `cistercian.encode(1993, 1)` lights `stem`, units `d`, tens `t l v`, hundreds `t l v`, thousands `t`.
  - `maya.encode(0, 1)` lights `shell`.
  - `kaktovik.encode(2026, 3)` gives cells for 5, 1, 6.
  - `morse.encode('B', 1)` gives dash, dot, dot, dot.
  - `braille.encode('b', 1)` gives dots 1 and 2.
  - `semaphore.encode('R', 1)` gives the two standard arms.
  - `tally.encode(7, 2)` gives one full gate, then 2 strokes.
  - `bargraph.encode(0.7, 10)` lights 7.
  - Every Nixie numeral's poly has ≥ 2 points and stays inside its cell.
- [ ] Step 2: Fails. Step 3: Implement. Step 4: Passes.
- [ ] Step 5: Commit: `add Nixie, Cistercian, Maya, Kaktovik, rod, Braille, Ogham, Morse, semaphore, dice, tally, BCD, bar graph and matrix types`.

### Task 8: Surfaces and readouts: panel, mix, value voice

**Files:**
- Create: `src/readout/layout.ts` (banded board and prims from readouts), `src/readout/voice.ts` (the value shader voice), `src/readout/surface.ts` (`createPanel`, frame loop, reshape), `src/readout/api.ts` (public types)
- Modify: `src/index.ts` (export `createPanel`, `createOverlay`, `TYPES`, types)
- Test: `test/readout-layout.test.ts`, `test/readout-surface.test.ts`

**Interfaces — Produces:**
```ts
export interface ReadoutOptions {
  type: TypeName;
  cells: number;
  face?: 'plate' | 'none';
  color?: number;
  slant?: number;
  ends?: 'point' | 'round' | 'square';
  align?: 'left' | 'right';
  gap?: number;
  half?: boolean;
  defects?: readonly (Fault & { at: { cell: number; slot: number } })[];
  at?: { x: number; y: number };
  height?: number; // panel, CSS px
  follow?: Element; // overlay
}
export interface Readout {
  set(value: string | number): void;
  color(hex: number): void;
  destroy(): void;
  readonly value: string | number;
}
export interface SurfaceOptions {
  gpu?: Gpu | null;
  backend?: Backend;
  lamps?: Lamps;
  fade?: Fade;
  ghost?: Ghost;
  ticker?: Ticker;
}
export interface Surface {
  readout(o: ReadoutOptions): Readout;
  readonly backend: Backend;
  destroy(): void;
}
export function createPanel(canvas: HTMLCanvasElement, opts?: SurfaceOptions): Surface;
// layout.ts
export function layOutReadouts(rs: readonly Placed[]): {
  board: Board;
  leds: readonly Led[];
  prims: Prims;
  bases: number[];
};
```

- **Layout:** each readout is one view. Its cells are placed at `cell * (width + gap)`; `half` adds a leading half cell. With `face: 'plate'` it gets a plate primitive (`NO_LIGHT`, socket `plate`) padded by `0.6` cell units, and segment sockets of `SOCKET.segment` (or `wire`). With `'none'` it gets no plate and socket `none`.
- **Panel views:** the canvas fills its CSS box (`ResizeObserver`, device px = CSS × `devicePixelRatio`). A readout's view is `ox = at.x*dpr`, `oy = at.y*dpr`, `scale = height*dpr / cell.height`, `slant` (default 0), clip = the canvas.
- **Voice:** a single surface-wide `shaderPatch` via `kernels` (`src/modulators/shader.ts`) with tables `on`, `tr`, `tg` and `tb`, each `cols × rows`. WGSL: `out.lit = table_on(subject.x, subject.y)`, and tint from `tr/tg/tb` as the gradient modulator writes it (`src/modulators/gradient.ts`). `set` and `color` rewrite the tables and re-cue the voice (fade the old over 0) on the next frame, coalescing several calls into one.
- **Reshape:** adding or removing a readout rebuilds the layout on the next frame and calls `sign.reshape`, registers the new subjects with `gpuOf(m).subjects`, re-applies every readout's defects, and re-cues the voice. Values persist in the readout objects.
- **Frame loop:** as `createMarquee`'s (ticker, `m.sync`, `pullChannels`, `sign.render`), without program, pass, overlay or follow.
- [ ] Step 1: Write the tests:
  - `test/readout-layout.test.ts`:
    - Two readouts, seven ×4 and fourteen ×2, give `board.cols = 4` and `rows = 9 + 16`, with the fourteen's bases at 9.
    - Phantom dots have no primitives.
    - A plate primitive per readout comes only with `face: 'plate'`.
  - `test/readout-surface.test.ts` (2D, jsdom canvas stubs as `test/marquee.test.ts` uses):
    - After `set('12')` and one ticker frame, the mix's `lit` for the `b` and `c` segments of cell 0 is 1 and `a` is 0.
    - Adding a second readout keeps the first's value.
    - Destroying a readout drops its lights from the next layout.
    - A defect `{ cell: 0, slot: 0, kind: 'dead' }` maps to surface `{ x: 0, y: base }`.
    - A layer cued on the surface's mix over a readout's subjects (`cueLayer` from `src/program.ts`, reached from the test only) changes `gain` on those segments.
    - With `webglSlot` exhausted, `backend: 'webgl'` gives `'2d'`.
- [ ] Step 2: Fails. Step 3: Implement. Step 4: Passes.
- [ ] Step 5: Commit: `add segment readouts on a shared panel, their values played by one shader voice`.

### Task 9: Overlay surface following page elements

**Files:**
- Create: `src/readout/overlay.ts`
- Test: `test/readout-overlay.test.ts`

**Interfaces — Produces:** `createOverlay(opts?: SurfaceOptions & { parent?: HTMLElement; z?: number }): Surface`.

The overlay appends a canvas with class `bree-overlay` to `parent` (default `document.body`). It is styled by an injected stylesheet (`position: fixed; inset: 0; pointer-events: none`), not inline styles.

Each frame, every followed readout reads `getBoundingClientRect()` and fits the type's whole width × height inside the rect, centered with aspect kept. Its clip is the rect intersected with every scrolling ancestor's (`overflow` other than `visible`) client rect, collected once when the readout is made. A readout whose clip is empty, or whose element is detached or `display: none`, gets `scale = 0`, and every backend culls those primitives in the vertex stage. A view change makes `update()` return true.
- [ ] Step 1: Write `test/readout-overlay.test.ts` with stubbed rects:
  - A readout in a 100 × 40 element with a 10-wide by 18-tall single-cell type gets `scale = 40*dpr/18`, centered horizontally.
  - An element half outside a scrolling pane's rect clips at the pane's edge.
  - A detached element gets scale 0.
- [ ] Step 2: Fails. Step 3: Implement. Step 4: Passes.
- [ ] Step 5: Commit: `add an overlay surface whose readouts follow page elements`.

### Task 10: Lab page and bench

**Files:**
- Create: `lab/readouts.html`, `lab/readouts.ts`, `lab/readouts.css`
- Modify: `lab/vite.config.ts` (add the `readouts` input), `lab/pages.ts` (add `readouts`), `lab/digits.ts` (add `way=readouts`), `scripts/bench.mjs` if it lists ways

The page is a root that fills the viewport and never scrolls (`html, body, #root { height: 100%; margin: 0; overflow: hidden }`), with a backend picker reusing `lab/backend.ts`.
- **Panel tab:** every `TYPES` entry as one readout, live. A clock drives `seven` (with colon) and `nixie`. A counter drives the number types, typed text drives the text types, and a slow sine drives `bargraph`. A face toggle switches between plate and none.
- **Overlay tab:** a scrolling grid of 60 cards in a pane, each following a readout.

`way=readouts` on the bench lays N `seven` readouts of 1 cell on one panel with `?stack=` ignored. The bench's report gains `readouts: N`.
- [ ] Step 1: Run `npm run lab:build` and confirm it builds.
- [ ] Step 2: Open the page headless (`.superpowers/shot.mjs` pattern, Playwright) on WebGPU, WebGL and 2D. Screenshot each tab and post the screenshots with `transom post`; the console shows no errors.
- [ ] Step 3: Run `node scripts/bench.mjs --page digits` with `way=readouts` and with `shared --stack=` at 500, through `onto do --kind bench --gui`. Record both rows in `docs/gpu-renderers.md`'s "Many small displays" table.
- [ ] Step 4: Commit: `add a readouts lab page and a readouts way to the digits bench`.

### Task 11: GPU checks for readouts

**Files:**
- Create: `test/gpu/readouts.gpu.ts`

The tests:
- A `seven` panel showing `8.` on WebGPU and WebGL matches 2D at each lit segment's midpoint (lit centers worst ≤ 2/255).
- `face: 'none'` leaves unlit pixels transparent.
- A Nixie readout's lit numeral is the brightest light.

- [ ] Run `npm run test:gpu` through `onto do -alone --kind test`. The new tests pass, and the existing 60 tests pass unchanged.
- [ ] Commit: `check readouts draw on WebGPU and WebGL as on 2D`.

### Task 12: Docs and cleanup

**Files:** `docs/superpowers/specs/2026-11-04-segment-readouts-design.md`, `README.md` (a "Readouts" section with the API sketch), `TODO.md`, `HANDOFF.md`, `docs/gpu-renderers.md`

- Rewrite the spec's "How it works" to match what was built, including the planning decisions above, and drop its "unbuilt" status line.
- In `TODO.md`, file Nixie front-wire occlusion and the overlay not skipping the optics for hidden readouts, if still true. Replace the "Segment readouts … designed and unbuilt" line with what's left.
- Delete this plan.
- Run the full suite on the fleet: `onto do -alone --kind test --task bree-readouts-final --expect 8m -- sh -c 'npm ci >/dev/null 2>&1; npm run typecheck && npm run lint && npx vitest run && npm run test:gpu'`.
- Commit: `document segment readouts and retire their plan`.
