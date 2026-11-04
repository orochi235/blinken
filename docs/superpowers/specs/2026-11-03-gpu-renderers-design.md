# GPU renderers: WebGPU, WebGL 2 and 2D

**Status: designed 2026-11-03, not built.** This is a design for whoever plans and builds bree's
renderer split. It covers the first of two projects. The second, 7-segment displays, gets its own
design once this one lands.

## Why

bree is going to export 7-segment displays, and later other display styles, that apps can use
wherever they show a number. A page should be able to hold hundreds of them, and 500 digits is
the low end of that. Today every sign is drawn in 2D canvas, with three offscreen canvases per sign
for glow, body and housing. Its effects are folded per light in JavaScript by a blits mix. Neither
of those scales to tens of thousands of lights. This project moves bree's drawing onto the GPU and
lets blits's new `gpu` engine fold effects there, using bree's current output (the marquee, its
border bulbs and thumbnails) as the first thing drawn.

## Goals

- **Three backends behind one renderer interface:** WebGPU, WebGL 2 and 2D (decided 2026-11-03).
  - **WebGPU** runs the mix on blits's `gpu` engine and draws directly from the GPU buffers it
    folds into (`gpuOf(mix).channel(name)`). Voices that can't run on the GPU fold on the CPU, and
    their channels are uploaded.
  - **WebGL 2** runs the stock CPU mixer, uploads the columns each frame and draws with shaders.
  - **2D** is today's `src/draw.ts`, with no change in behavior.
- **A shared device, passed in** (decided by Mike 2026-11-03). The page calls one async function
  once to get a GPU handle and passes it to every sign. `createMarquee` and `createThumbnail` stay
  synchronous. A sign given the handle draws with WebGPU. A sign without one uses WebGL if the
  browser has it, and 2D otherwise. An option forces a backend, for the lab, tests and benchmarks.
  One handle serves every sign on the page, so the segment displays can share one device later.
  The names are left to the builder.

  ```ts
  const g = await gpu(); // once per page; resolves to null without WebGPU
  const a = createMarquee(c1, { gpu: g });
  const b = createMarquee(c2); // WebGL, or 2D
  ```
- **The GPU backends may look better than 2D** (decided 2026-11-03), with real bloom and a softer
  filament. They may change how a light glows and how its shape renders. They may not change what
  a scene shows: colors, brightness, timing and layout match 2D. WebGPU and WebGL share one look.
  (My call: the shared look and the bounds on "better" were mine; the go-ahead to look better was
  Mike's.)
- **A light is a shape plus a place.** The GPU renderers draw every light as an instance that
  points into a table of shapes. This round fills that table with only the round dot and the
  border bulb. 7-segment, 14- and 16-segment bars, and later styles will add shapes and layouts
  there instead of writing new renderers. A style also carries a **material**, meaning how its
  light glows. LED is the only material this round, but it sits behind a seam that a VFD or LCD
  material could plug into later. (My call.)
- **Post-mix optics move to the GPU** on both GPU backends: fades (`settle`), ghosting (`ghosts`),
  defects (`afflict`), the follow-another-sign overlay (`follow` in `marquee.ts`), and the
  highlight's inverted dots. Each is a per-light loop in JavaScript today.
- **Port effects to `shaderPatch`** so they fold on the GPU under WebGPU. Modulators come first,
  since each is a plain `patch(fn)` over a dot's place, the phase and a hash. Moves are blocked;
  see Constraints. A patch that isn't ported keeps working on the CPU path, and the engine says
  why.
- **A backend switch in the lab**, so the backends can be compared side by side and the GPU look
  tuned by eye.

## Done

Done is defined by the `excelsior` skill (2026-11-03): the work is as fast and functional as it can
reasonably be, and further enhancement brings insufficient, diminishing returns. In practice:

1. **A benchmark comes first.** It sweeps light counts (for example 1,000, 4,000, 20,000 and
   80,000) on each backend with a typical effect stack, and records the mix time, the draw time
   and the frame time. It extends the `FrameCost` (`mixMs`, `drawMs`) that `createMarquee`'s
   `onFrame` already reports. It prints one line per run as it goes and keeps every run's raw
   record, including the machine and conditions, as the run finishes.
2. **Then rounds of profile and fix.** Each round's cost and gain are recorded next to each other.
3. **Stop on the curve.** The work ends when a round's gain is small next to its cost and next to
   earlier rounds, and the report gives those numbers.

## Non-goals

- 7-segment displays and other styles. The shape table and the material seam are built; the
  segment layouts and shapes come in the next project.
- Changing what the 2D backend draws.

## Anti-goals

- **A GPU scene that reads differently from 2D.** For example, a color shift, a different timing,
  or a light that's lit on one backend and dark on the other.
- **Unported effects breaking.** Every effect must run on every backend, on the CPU path where it
  can't run on the GPU.
- **A second copy of anything that decides what a scene shows** (layout, color mapping such as
  `dotColor`, timing). The GPU look needs shaders in two languages, WGSL and GLSL. Anything
  outside the look stays defined once.

## Constraints

- **blits version.** bree is on `@msb235/blits` 0.16.1. The `gpu` subpath first appeared in 0.18.0.
  `angle()` (bree's `hue` channel) gained GPU support in blits `bddfb8d`, and shader-patch tables
  arrived at `b269ec9` (both 2026-11-03, on main, unreleased and unpushed). Publishing it is Mike's call. Until a release exists, the lab and tests can use the
  sibling checkout (`blits.config.ts`); CI and Pages install from npm.
- **Which voices fold on the GPU** (blits `src/gpu/eligible.ts`): only a `shaderPatch` with a
  numeric weight that reaches every subject, with no stagger, owner, state, step or bounds. The
  decision is made per channel. If any playing voice that writes a channel can't run on the GPU,
  that channel folds on the CPU for the frame. The WebGPU renderer therefore takes each channel
  from either a GPU buffer or an uploaded CPU column, chosen frame by frame.
- **Moves read tables.** Every move writes `lit` from the message bitmap at a shifted position
  (`at.text.level(...)`, `src/moves/move.ts`), so `lit` reaches the GPU only once moves are ported.
  They are in scope. blits main (`b269ec9`, unreleased) gives shader patches tables:
  `shaderPatch(ms, { tables: { bitmap: { width, height }, rows: { width: 1, height: n } }, … })`,
  with contents passed per voice through `.with({ bitmap, rows })` (row-major), read as
  `table_bitmap(x, y)` in WGSL and `params.bitmap(x, y)` in `at`. Coordinates are floored and out
  of range reads 0. New contents upload without recompiling. A move uses two tables: the bitmap,
  and the row map (`at.rowOf`, stored as row+1 so 0 means no row).
- **blits voice kinds on the GPU.** blits main also folds keys, wave, tween, spring and glide voices
  on the GPU. Staggered voices are not done yet (blits's phase 2), so ranked modulator spreads keep
  their channels on the CPU until then.
- **WebGL's context cap.** Browsers allow about 16 live WebGL contexts per page. One context per
  sign is fine for today's marquees. The segment-display project will have to handle the cap
  (likely with a shared overlay canvas); this project must not rule that out.
- **Tests.** vitest runs in `node` (`vitest.config.ts`), with no GPU. GPU checks need a real
  browser with WebGPU. blits runs its own on the fleet node `teitou` (`npm run test:gpu`); bree
  should do the same.
- **Packaging.** bree is unpublished (`0.0.0`, private), so the API can change without
  deprecation. `createSign` and `Sign` in `src/draw.ts` are public exports today.

## Calls made after review (2026-11-03, mine unless marked)

- **`Marquee.columns` is not kept whole on WebGPU.** Only `follow` (`src/marquee.ts`) and tests read
  it. Keeping it current would mean `m.pull` for every channel, every frame, and that cancels the
  GPU fold. On WebGPU, `follow` and `setHighlight` run on the GPU, and a followed sign must share
  its follower's device. If it doesn't, the follow falls back to a one-frame-late readback.
  `columns` stays complete on 2D and WebGL. Tests that read it pin one of those backends.
- **Shaders are checked copies, not generated ones.** `dotColor`, `settle`, `ghosts` and `afflict`
  get WGSL and GLSL versions beside their TS, and agreement tests compare each GPU version with
  its TS on sampled inputs. This is the pattern blits uses for `shaderPatch`. The anti-goal
  above is read as "no copy without an agreement test".
- **Only part of the modulator porting happens this round.** Modulators whose spread is `together`
  (no per-dot rank) get ported now. Ranked spreads wait for blits's phase 2, when rank becomes a
  stagger. `stageLayer` (`src/program.ts`) currently rewraps each layer in a plain `patch(...)`
  to stretch its cycles, which drops a `shaderPatch`. It must stretch in a way that keeps one,
  for example by passing the stretch as a shader parameter.
- **What "matches 2D" means.** Per light, the color at the light's center and the total light it
  emits (body plus bloom, summed over its neighborhood) must each match 2D within a tolerance.
  The builder sets that tolerance from measured 2D output and records it. Bloom's spread may
  differ. These checks run in a real browser on the fleet.

## Left to the builder

- The renderer interface. `Sign.render(cols, fallback, dt)` is the natural seam, but the WebGPU
  backend needs to receive GPU buffers as well as CPU columns.
- The shader structure, the instance layout, and how the shape table and material are encoded.
- How bloom is done (separable blur, mip chain or something else), within the look bounds above.
- The order modulators are ported in, guided by the benchmark.
- How `createThumbnail` and the lab's many small signs share devices and contexts.
- Context-loss handling on both GPU backends.
