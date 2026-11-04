# GPU Renderers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw bree's signs with WebGPU, WebGL 2 or 2D behind one interface. Under WebGPU, effects fold on the GPU through blits's `gpu` engine.

**Architecture:** `Sign` (`src/draw.ts`) stays the seam. The per-light work the 2D sign does today moves into one TS module, `optics-frame`, that turns the mix's columns into a shine and an RGB value per light. 2D and WebGL both call it. WebGPU runs a WGSL twin of it in a compute pass that reads blits's GPU buffers. Both GPU backends draw every light as an instanced quad from one shape table, then bloom and composite.

**Tech Stack:** TypeScript, WebGPU (WGSL), WebGL 2 (GLSL ES 3.00), `@msb235/blits` `gpu` subpath, vitest (node), Playwright Chromium (`channel: 'chromium'`, `--enable-unsafe-webgpu`) for GPU tests and the benchmark.

**Spec:** `docs/superpowers/specs/2026-11-03-gpu-renderers-design.md`

## Global Constraints

- Backends are `'webgpu' | 'webgl' | '2d'`. A sign given a `gpu` handle uses WebGPU. Without one it uses WebGL where `canvas.getContext('webgl2')` works, and 2D otherwise. `backend` forces one.
- `createMarquee` and `createThumbnail` stay synchronous. `gpu(): Promise<Gpu | null>` is the only async entry point.
- 2D output is unchanged. Every existing test in `test/` passes unmodified, except tests of `columns` that now pin `backend: '2d'`.
- GPU look bound: per light, the center color and the total emitted light match 2D within a tolerance that is measured and recorded. Bloom spread may differ.
- Every GPU copy of a TS function (`dotColor`, `settle`, `afflict`, `ghosts`, `hash`, and each ported patch) has an agreement test against the TS.
- blits resolves from `../blits` where present (`blits.config.ts`). The `@msb235/blits/gpu` alias must come before `@msb235/blits` in every alias map, because vite matches by prefix.
- The package floor goes to `@msb235/blits@^0.20.0` (published, has `gpu`). `angle()` WGSL and shader tables are on blits main only, so CI on npm runs without them. Code must degrade there (the channels stay on the CPU), not fail.
- Data on disk: benchmark records go to `bench/runs/` (gitignored). The runner keeps the newest 200 files and deletes the rest at startup.
- US English. No inline styles, no `!important`. Files stay under a few hundred lines; split by responsibility.
- Commit after each task, imperative lowercase subjects, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **A sign whose device is lost mid-run** (sleep, driver reset) should keep drawing. Expected: it rebuilds on a fresh `gpu()` if one is given again, and draws nothing while it waits, without throwing. Test in Task 6.
- **A canvas sized 0 × 0** (hidden tab, unlaid parent) on any backend should draw nothing and not throw, the way 2D does now. Test in Tasks 5 and 6.
- **A mix whose voices are partly GPU-eligible**, for example rainbow (`hue`) on a blits without angle WGSL, should still get correct colors, with CPU columns filling the channels the GPU didn't fold. Test in Task 6.
- **`destroy()` on a GPU sign** should release its buffers and textures and stop observing resize, and a second `destroy()` should do nothing. Test in Tasks 5 and 6.
- **More than about 16 WebGL signs on one page** (the lab's thumbnail grid): the 17th must not silently kill the first. Expected: once a page holds 12 live WebGL contexts, later signs fall back to 2D. Test in Task 5.

---

## File Structure

| File                                                           | Responsibility                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/render/backend.ts`                                        | `Backend` type, `pickBackend`                                                          |
| `src/render/gpu.ts`                                            | `Gpu` handle, `gpu()`                                                                  |
| `src/render/lights.ts`                                         | Shape table, material, per-light instance data (place, shape, radius)                  |
| `src/render/optics-frame.ts`                                   | Per-light shine and RGB from columns: the loop body of today's `render`, extracted     |
| `src/render/bloom-params.ts`                                   | Bloom radius, strength and composite constants shared by both GPU look implementations |
| `src/render/webgl/sign.ts`                                     | WebGL 2 `Sign`                                                                         |
| `src/render/webgl/glsl.ts`                                     | GLSL sources                                                                           |
| `src/render/webgpu/sign.ts`                                    | WebGPU `Sign`                                                                          |
| `src/render/webgpu/wgsl-optics.ts`                             | WGSL: hash, settle, afflict, ghosts, dotColor, highlight, follow                       |
| `src/render/webgpu/wgsl-draw.ts`                               | WGSL: instanced shapes, bloom, composite                                               |
| `src/render/webgpu/sources.ts`                                 | Per channel, the GPU buffer from `gpuOf(m).channel()` or an uploaded CPU column        |
| `src/draw.ts`                                                  | 2D `Sign` (`createSign`), now calling `optics-frame`                                   |
| `src/marquee.ts`, `src/marquee-api.ts`, `src/thumbnail.ts`     | `gpu` and `backend` options, engine choice, partial pull                               |
| `src/modulators/shader.ts`                                     | `stretchable` helper: a shader modulator stretched by a `cycles` param                 |
| `src/moves/shader.ts`                                          | Bitmap and row tables for moves                                                        |
| `test/gpu/*.gpu.ts`, `test/gpu/run.mjs`, `test/gpu/harness.ts` | Browser agreement tests (blits's pattern)                                              |
| `scripts/bench.mjs`, `lab/bench.html`, `lab/bench.ts`          | Benchmark                                                                              |

---

### Task 1: Dependency, aliases and the GPU test runner

**Files:**
- Modify: `package.json` (dep `@msb235/blits` to `^0.20.0`; scripts `test:gpu`, `bench`), `blits.config.ts`, `tsconfig.json` (`paths` for `@msb235/blits/gpu` → `../blits/src/gpu.ts`, `./node_modules/@msb235/blits/dist/gpu.d.ts`), `.gitignore` (`bench/runs/`)
- Create: `test/gpu/run.mjs`, `test/gpu/harness.ts` (copied from blits `test/gpu/`, aliasing `@msb235/blits` and `@msb235/blits/gpu` to the checkout and `@/` to `src`), `test/gpu/smoke.gpu.ts`

**Interfaces:**
- Produces: `blitsAlias` includes `'@msb235/blits/gpu'` first. `npm run test:gpu [filter]` runs `test/gpu/*.gpu.ts` in headless Chromium and prints `n/N ✓ name` per test. The harness exports `test(name, fn(device))`, `close(got, want, what, abs?)`, `closeNear`.

- [ ] **Step 1:** Write `smoke.gpu.ts`, a test that `gpu` from `@msb235/blits/gpu` makes a mix whose `gpuOf(m).channel('lit')` is non-null after a sync with one shaderPatch voice.
- [ ] **Step 2:** `npm install`, then `npm run test:gpu`. Expected: `1/1 ✓`.
- [ ] **Step 3:** Run `npm run check`. Expected: lint, typecheck and all existing tests pass.
- [ ] **Step 4:** Commit: "bump blits to 0.20, alias its gpu subpath, and run browser GPU tests".

### Task 2: Extract the per-light frame into `optics-frame`

**Files:**
- Create: `src/render/optics-frame.ts`, `test/optics-frame.test.ts`
- Modify: `src/draw.ts` (the 2D render loop calls it; draws from `shine` and `rgb`)

**Interfaces:**
- Produces:

  ```ts
  export interface Lit { shine: Float32Array; rgb: Float32Array /* 3 per light, 0..1 sRGB */ ; bloom: Float32Array /* halo scale per light */ }
  export interface OpticsFrame {
    step(cols: SignColumns, fallback: number, dt: number, brightness: number, out: Lit): void;
    setDefects(d: readonly Defect[]): void; setFade(f: Fade): void; setGhost(g: Ghost): void;
  }
  export function createOpticsFrame(b: Board, leds: readonly Led[]): OpticsFrame;
  export function lit(n: number): Lit;
  ```

  `shine[i]` is today's `shine`, set to 0 where `now < 0.02`. `rgb` is `dotColor(...)` split into channels / 255. `bloom[i]` is `glow[i]`.

- [ ] **Step 1:** Write a test that, for a 4 × 2 board with one dead, one stuck and one dim defect, ghost `{row: 0.2}` and `dt` 16, checks `step` gives the same per-light shine and hex as the current inline loop. Capture the expected values by running today's `draw.ts` math in the test via exported `shownLit`, `settle`, `afflict`, `ghosts`, `dotColor`.
- [ ] **Step 2:** Run `npx vitest run test/optics-frame.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement it, and switch `createSign`'s loop to it.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass, `draw.test.ts` included.
- [ ] **Step 5:** Commit: "move the per-light shine and color out of the 2D sign into one shared frame step".

### Task 3: Light table, shapes and material

**Files:**
- Create: `src/render/lights.ts`, `src/render/bloom-params.ts`, `test/lights.test.ts`

**Interfaces:**
- Produces:

  ```ts
  export const SHAPES = { dot: 0, bulb: 1 } as const; export type ShapeName = keyof typeof SHAPES;
  export interface Material { readonly name: 'led'; readonly core: number /* 0.45, the white center's share of radius */; readonly coreTint: number /* 0xfff4e0 */; readonly coreAlpha: number /* 0.55 */ }
  export const LED: Material;
  export interface LightTable { readonly n: number; readonly at: Float32Array /* x,y per light, pitches from frame top-left */; readonly shape: Uint32Array; readonly radius: Float32Array /* pitches, before lamps.size */; readonly frame: { across: number; down: number } }
  export function lightTable(b: Board, leds: readonly Led[], grid: Grid): LightTable;
  ```

  `radius` matches `draw.ts` (`size * 6/12` dot, `7/12` bulb, with `size` applied by the renderer). `bloom-params.ts` exports `BLOOM = { spread: 0.9 /* pitches, × lamps.glow */ }` and the housing colors `0x0d0a08`, dot `0x21150f`, bulb `0x2b2118`, used by all three backends. `draw.ts` imports them in place of its literals.

- [ ] **Step 1:** Test that `lightTable` on a 3 × 2 board with border on `GRIDS.hex` gives each led's `at` equal to `grid(x, y) − (left, top)` from `frameOf`, and gives bulbs shape 1.
- [ ] **Step 2:** Run it; expect FAIL. Implement. Run; expect PASS.
- [ ] **Step 3:** Commit: "give each light a place, a shape and a material in one table the GPU renderers draw from".

### Task 4: `gpu()`, `Backend` and choosing one

**Files:**
- Create: `src/render/gpu.ts`, `src/render/backend.ts`, `test/backend.test.ts`
- Modify: `src/index.ts` (export `gpu`, `type Gpu`, `type Backend`)

**Interfaces:**
- Produces:

  ```ts
  export interface Gpu { readonly device: GPUDevice; readonly format: GPUTextureFormat; readonly lost: Promise<void> }
  export async function gpu(): Promise<Gpu | null>; // null without navigator.gpu, adapter or device
  export type Backend = 'webgpu' | 'webgl' | '2d';
  export function pickBackend(want: Backend | undefined, handle: Gpu | null | undefined, canWebgl: () => boolean): Backend;
  export function webglSlot(): (() => void) | null; // claims one of 12 page-wide WebGL slots; the returned function releases it
  ```

  `pickBackend`: an explicit `want` wins, except that `webgpu` without a handle throws `bree: backend 'webgpu' needs a gpu handle`. Otherwise it's `webgpu` with a handle, then `webgl` if `canWebgl()`, then `2d`.

- [ ] **Step 1:** Unit tests for each branch of `pickBackend`, and for `webglSlot` returning null on the 13th claim and a slot again after a release.
- [ ] **Step 2:** Run, see FAIL, implement, see PASS.
- [ ] **Step 3:** Commit: "add the gpu handle and backend choice".

### Task 5: WebGL 2 sign

**Files:**
- Create: `src/render/webgl/sign.ts`, `src/render/webgl/glsl.ts`, `test/gpu/webgl.gpu.ts`

**Interfaces:**
- Consumes: `createOpticsFrame`, `lightTable`, `LED`, `BLOOM` (Tasks 2–3).
- Produces: `createWebGlSign(canvas, b, leds, backed, grid): Sign & { readonly backend: 'webgl' }`, with the same resize and pixel-ratio following as `createSign`. It returns null if no `webgl2` context or no `webglSlot()`.

Draw: per frame, `step` fills `Lit`. Upload `shine`, `rgb` and `bloom` into one instance buffer (`bufferSubData`), then:
1. housing pass: static, drawn once per resize into a texture;
2. instanced quad per light into a half-float glow target (premultiplied `rgb·shine`, Gaussian falloff out to `bloom · radius · BLOOM.spread · lamps.glow`);
3. separable blur on that target, two passes, at half resolution;
4. instanced bodies: disk of `radius` with a smoothstep edge, the core at `LED.core` radius tinted `LED.coreTint` at `coreAlpha·shine`;
5. composite: housing, then glow additively, then bodies.

On `webglcontextlost`, call `preventDefault()` and make render a no-op. On `webglcontextrestored`, rebuild every GL resource.

- [ ] **Step 1:** In `webgl.gpu.ts`, test that for a 10 × 3 marquee-free sign fed fixed columns (every third dot lit, tint red), `readPixels` at each lit dot's center is within 8/255 of 2D's pixel at the same place, and that a dark dot reads within 8/255 of the housing color.
- [ ] **Step 2:** Test that a 0 × 0 canvas renders without throwing, and that `destroy()` twice is safe and frees the slot.
- [ ] **Step 3:** Run `npm run test:gpu webgl`; expect FAIL. Implement. Run; expect PASS.
- [ ] **Step 4:** Commit: "draw signs with WebGL 2: instanced lights, separable bloom".

### Task 6: WebGPU sign

**Files:**
- Create: `src/render/webgpu/sign.ts`, `src/render/webgpu/sources.ts`, `src/render/webgpu/wgsl-optics.ts`, `src/render/webgpu/wgsl-draw.ts`, `test/gpu/optics.gpu.ts`, `test/gpu/webgpu.gpu.ts`

**Interfaces:**
- Consumes: `Gpu`, `lightTable`, `LED`, `BLOOM`; blits `gpuOf(m)` and `GpuChannel`.
- Produces:

  ```ts
  export interface ChannelSource { channel(name: keyof SignColumns): GpuChannel | null }  // gpuOf(m) satisfies it
  export function createWebGpuSign(canvas, b, leds, backed, grid, handle: Gpu, source: ChannelSource | null): Sign & {
    readonly backend: 'webgpu';
    setHighlight(mask: Uint8Array | null): void;            // per dot, 1 = swap lit
    setFollow(from: { lit: GPUBuffer; map: Uint32Array; planes: readonly Plane[] } | null): void;
    readonly output: GPUBuffer;                              // this sign's per-light post-mix pose, for a follower
  }
  ```

  `render(cols, fallback, dt)` reads each channel from `source.channel(name)` where it's non-null, and from `cols` (uploaded) where it's null. Bulbs take their cell's values through `b.cellOf`, on the GPU.

  The compute pass (`wgsl-optics.ts`) mirrors `optics-frame` exactly: `hash` (u32, wrapping multiply, `>> 15`, `>> 13`), `shownLit`, `afflict`, `settle` (`1 - exp(-dt/ms)`, persistent `shown` buffer), `ghosts` (row and column means, a second dispatch), then highlight, then `dotColor`, using blits's `LINEAR_WGSL`-style OKLab → linear → sRGB with clipping and the `fallback` laid under partial coverage. The draw pass is the same five steps as Task 5, in WGSL, reading the compute output as a storage buffer.

  Device loss: on `handle.lost`, the sign stops drawing (render is a no-op) and does not throw.

- [ ] **Step 1:** In `optics.gpu.ts`, write agreement tests that run the compute pass on 2,000 random lights (random columns, all four fault kinds, ghost on, three `dt`s) and compare `shine` within `close` tolerance and `rgb` within 1/255 against `optics-frame`.
- [ ] **Step 2:** In `webgpu.gpu.ts`, write the same pixel test as Task 5 Step 1 against 2D. Add one where `source` returns null for `hue` (the CPU fills it): a rainbow-like hue column must give the same colors as 2D. Add a 0 × 0 canvas test, a double-`destroy()` test, and a `device.destroy()`-then-render test that expects no throw.
- [ ] **Step 3:** Run `npm run test:gpu`; expect FAIL. Implement. Run; expect PASS.
- [ ] **Step 4:** Commit: "draw signs with WebGPU, folding optics and color on the GPU from blits's buffers".

### Task 7: Wire backends into the marquee and thumbnail

**Files:**
- Modify: `src/marquee.ts`, `src/marquee-api.ts`, `src/thumbnail.ts`, `test/marquee.test.ts` (the `columns` tests pass `backend: '2d'`)
- Create: `test/gpu/marquee.gpu.ts`

**Interfaces:**
- Consumes: Tasks 4–6.
- Produces: `MarqueeOptions.gpu?: Gpu | null`, `MarqueeOptions.backend?: Backend`, `ThumbnailOptions` passes both through, `Marquee.backend: Backend`, and `FrameCost.backend`.

Under WebGPU:
- The mix is made with `engine: gpu({ device })`, and `gpuOf(m).subjects([...b.dots, ...b.cells], fieldsOf)` is called with `fieldsOf(s) = { x, y, cell: kind === 'cell' ? 1 : 0, i }`.
- Each frame, `m.pull` reads only the channels `gpuOf(m).channel(name)` returns null for (a `Columns` object holding just those keys).
- `follow` with a WebGPU source on the same device calls `setFollow` with the source's `output` and a dot map computed once. Otherwise it reads the source's `columns`, a frame late.
- `setHighlight` builds the mask and calls the sign's `setHighlight`.
- `columns` holds only the CPU-folded channels, and the doc comment on `Marquee.columns` says so.

- [ ] **Step 1:** In `marquee.gpu.ts`, test that a `createMarquee` with `{ gpu: await gpu() }` playing the `scroll` builtin for 500 ms reports `backend === 'webgpu'` and draws pixels within tolerance of a `backend: '2d'` twin seeked to the same time and held.
- [ ] **Step 2:** In vitest, test that `createMarquee(canvas, { backend: '2d' })` reports `'2d'`, and that with no options in node (no WebGL) it falls back to `'2d'`.
- [ ] **Step 3:** Implement. Run `npm run check` and `npm run test:gpu`; expect PASS.
- [ ] **Step 4:** Commit: "let a marquee draw with WebGPU, WebGL or 2D, folding on the GPU where it can".

### Task 8: Shader modulators, and `stageLayer` that keeps them

**Files:**
- Create: `src/modulators/shader.ts`, `src/render/wgsl-hash.ts` (the WGSL `hash` shared with Task 6), `test/gpu/modulators.gpu.ts`
- Modify: `src/modulators/modulator.ts` (optional `shader`), `src/program.ts` (`layerPatch`, `stageLayer`, `cueLayer`), each ported modulator file

**Interfaces:**
- Produces: `Modulator.shader?(at: Placed, p: Values<P>): ShaderPatch<Subject, Pose, { cycles: number } & Record<string, number>>`. Its WGSL reads the phase as `ph = fract(phase * params.cycles)`, and its `at` does the same with `params.cycles`. `layerPatch` uses `shader` when the layer's spread is `TOGETHER` and the modulator has one. Otherwise it uses `patch` as today. `stageLayer` stretches a shader layer with `.with({ ...values, cycles })` instead of rewrapping it. Subject fields are `x`, `y`, `cell`, `i` (Task 7).

Port order, ranked by what the benchmark's typical stack uses: `sparkle`, `color` (rainbow), `chase`, `flash`, `scanline`, `shimmer`, `gradient`, `neon`, `invert`, then the rest as the benchmark justifies them (per the spec's Done section).

- [ ] **Step 1:** For each ported modulator, an agreement test in `modulators.gpu.ts` cues it on a 40 × 7 board under the gpu engine and compares `channel()` readback against `probe` on 3 phases, within `close`.
- [ ] **Step 2:** A vitest test that `stageLayer` on a shader modulator returns a patch for which `gpuDescriptor` is defined (import it from blits).
- [ ] **Step 3:** Implement, porting one modulator per commit after the first. Run both suites; expect PASS.
- [ ] **Step 4:** Commit per modulator: "fold <name> on the GPU".

### Task 9: Shader moves

**Files:**
- Create: `src/moves/shader.ts`, `test/gpu/moves.gpu.ts`
- Modify: `src/moves/move.ts` (optional `shader`), `src/effects.ts` (staging uses it when present), and the ported move files

**Interfaces:**
- Produces: `bitmapTables(at: Placed): { bitmap: Float32Array; rows: Float32Array; width: number; height: number; rowsLen: number }`, where `rows[y] = at.rowOf({kind:'dot',x:0,y}) + 1` (0 meaning no row) for `y` in `0 .. board.rows + text.rows`. WGSL helpers `level(x, y)` (`table_bitmap`) and `row_of(y)` (`table_rows(0, y) - 1`) mirror `litAt` and `movedAt`.
- `Move.shader?(at, p, joins): ShaderPatch<Led, Pose, …>`, used in place of `patch` when present.

Port order: `stand`, `scroll`, `cut`, `drop`, `type`, then the others as the benchmark justifies them. This needs blits main's tables. On npm's 0.20 the shader factory isn't called: `move.shader` is used only when `'tables' in` the shaderPatch spec type is supported, which the code detects once by feature-testing `shaderPatch(1, { tables: {...}, … })` in a try/catch.

- [ ] **Step 1:** An agreement test per ported move: GPU `lit` against `probe` at 5 phases on a 60 × 7 board, with a message both narrower and wider than the board.
- [ ] **Step 2:** Implement. Run; expect PASS.
- [ ] **Step 3:** Commit per move: "fold the <name> move on the GPU".

### Task 10: Lab backend switch

**Files:**
- Modify: `lab/compose/store.ts` (a `backend` field, persisted like other prefs), `lab/compose/Playback.tsx` (a select: Auto, WebGPU, WebGL, 2D, with a tooltip on each option and no ⓘ icon), the lab entry point (calls `gpu()` once at startup and shares the handle)

- [ ] **Step 1:** Implement. Then start the lab (`npm run dev`, in the background), and use headless Playwright to switch each backend, screenshot each and post the screenshots with `transom post` to the zone `bree`.
- [ ] **Step 2:** Commit: "let the lab switch backends".

### Task 11: Benchmark and rounds

**Files:**
- Create: `lab/bench.html`, `lab/bench.ts`, `scripts/bench.mjs`; register `bench` in `lab/vite.config.ts` inputs

**Interfaces:**
- `bench.ts` reads `?backend=&lights=&stack=&seconds=` and builds one marquee with `cols × rows ≈ lights` (rows 7 for 1,000 and under, otherwise square-ish). It plays `scroll` under `sparkle`, `color` and `chase` layers, collects every frame's `FrameCost` plus `requestAnimationFrame` intervals, and prints `__bench__ {json}` once.
- `bench.mjs` sweeps backends × {1,000, 4,000, 20,000, 80,000}, once through each before any repeat. It prints `k/N backend lights: fps p50/p95 mixMs drawMs` per run, writes one JSON record per run to `bench/runs/<iso>-<backend>-<lights>.json` (including machine, Chrome version, GPU adapter info and every frame's raw numbers), and prunes the directory to the newest 200 files at startup.

- [ ] **Step 1:** Build the bench and run it once. Expected: a line per run, and records on disk.
- [ ] **Step 2:** Rounds per the `excelsior` skill: profile, fix the biggest cost, re-run, and record each round's gain against its cost in `docs/gpu-renderers.md` (Task 12). Stop when a round's gain is small next to its cost and next to earlier rounds.
- [ ] **Step 3:** Commit per round: "<what changed> (<before> → <after> at <lights> lights)".

### Task 12: Docs and cleanup

**Files:**
- Modify: `README.md` (a "GPU" section: `gpu()`, `backend`, what folds where), `TODO.md` (what's left: ranked spreads waiting on blits phase 2, unported modulators and moves, the segment-display project), `HANDOFF.md`
- Create: `docs/gpu-renderers.md` (benchmark results and the round log, measured tolerances)
- Delete: this plan, and mark the spec built (its opening status line), or delete it once `docs/gpu-renderers.md` carries what's worth keeping

- [ ] **Step 1:** Write the docs. Run `npm run check`; expect PASS.
- [ ] **Step 2:** Commit: "document the GPU backends and their benchmark".
