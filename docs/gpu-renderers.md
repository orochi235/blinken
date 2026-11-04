# GPU renderers: benchmark and rounds

For whoever works on how bree draws. It answers: how the three backends (2D, WebGL, WebGPU) are
built and what "matches 2D" means, what a frame costs on each as the light count grows, what each
round of tuning bought, and where tuning stopped and why. How to use them is in the
[README](../README.md#gpu).

## Design

Decided by the maintainer 2026-11-03: three backends behind one `Sign` (`src/render/`), the GPU
ones may look better than 2D (real bloom, a softer filament), and one shared device passed in to
every sign (`gpu()` called once per page, so creating a sign stays synchronous).

Chosen while building, not by the maintainer (2026-11-03): the bound on "better" and what "matches 2D" means
(below), WebGPU and WebGL sharing one look, the shape-plus-place light table and `Material` seam,
`columns` not kept whole on WebGPU, and shader copies checked by agreement tests.

What a scene shows, meaning colors, brightness, timing and layout, is the same on all three.

| backend | folds the mix                                       | draws                                                  |
| :------ | :-------------------------------------------------- | :----------------------------------------------------- |
| WebGPU  | on blits's `gpu` engine, where every voice allows   | from the GPU buffers the fold wrote; the rest uploaded |
| WebGL 2 | on the CPU (stock mixer); columns upload each frame | instanced lights, separable blur                       |
| 2D      | on the CPU                                          | `src/draw.ts`, refactored; output unchanged            |

- **A light is a shape plus a place.** Every light is an instance that points into a table of
  shapes (`SHAPES` in `src/render/lights.ts`: the round dot and the border bulb). New displays add
  shapes and layouts there rather than renderers. How a light glows is its `Material`; `LED` is the
  only one, behind a seam a VFD or LCD material can plug into.
- **Post-mix optics run on the GPU on WebGPU only**: fades (`settle`), ghosting (`ghosts`),
  defects (`afflict`), `follow`, and the highlight. WebGL runs them on the CPU
  (`src/render/optics-frame.ts`) and uploads the result.
- **Matches 2D** means, per light, the center color and the total light (body plus bloom) each agree
  with 2D; bloom's spread may differ. Measured on a 10 × 3 board at pitch 24 px, dpr 1, Apple
  Metal 3, on both GPU backends: lit centers within 1/255, dark centers within 1/255, total light
  0.998× 2D's. The tests assert 8/255 per center and ±5% total light
  (`test/gpu/webgl.gpu.ts`, `test/gpu/webgpu.gpu.ts`); those bounds are the contract, and the
  measured figures are what this machine showed. Bodies are added to the glow, as 2D's
  `lighter` composite does; laying them over read 21/255 off.
- **A shader that copies TS has an agreement test.** `dotColor`, `settle`, `ghosts`, `afflict`, the
  hash and every ported modulator and move have a WGSL (and for the draw, GLSL) copy beside the TS
  and a test comparing the two on sampled inputs. Worst measured gaps: hash 0 bit mismatches over
  65,536 triples; optics 1.2e-7 in shine, 1/255 in color; modulators under 1e-4 (degrees for hue),
  moves 3.4e-8, run with `npm run test:gpu`.
- **Which voices fold on the GPU** is blits's rule (`src/gpu/eligible.ts` in blits): on blits 1.0,
  a `shaderPatch` over any of its subjects, staggered by name or looping, under owners at any depth, weighted by a number or a signal; its own list says what stays on the CPU.
  It is decided per channel: if one playing voice writing a channel cannot run there, the channel
  folds on the CPU that frame and WebGPU uploads it.
- **Moves read tables.** A move writes `lit` from the message bitmap at a shifted place, so its
  shader reads two blits shader tables, the bitmap and the row map (`src/moves/shader.ts`).
- **`columns` on WebGPU** holds only what the CPU folded: keeping it whole would pull every channel
  every frame and cancel the GPU fold. `follow` and `setHighlight` run on the GPU there, and a
  followed sign must share its follower's device, or the follow reads back a frame late.
- **Done** is defined by the `excelsior` rule (2026-11-03): as fast and functional as it can
  reasonably be, with a benchmark first, rounds of profile and fix with cost and gain side by side,
  and a stop when a round's gain is small next to its cost and earlier rounds.

## The benchmark

`npm run bench` builds the lab and sweeps 2D, WebGL and WebGPU over 1,000, 4,000, 20,000 and
80,000 lights in headless Chromium on the machine's real GPU. It goes once through every pair
before any repeat and prints one line per run. Flags: `--backends`, `--lights`, `--seconds`
(default 5), `--repeat`, `--stack`, `--label` and `--no-build`.

Each run is one page, `lab/bench.html`. It plays the `scroll` effect under the `sparkle` and
`rainbow` layers with the border's bulbs in a chase. A board of 1,000 lights or fewer is 7 rows
tall, one line of text; a larger board is square. Frames are uncapped (no vsync), so fps measures
throughput rather than the display. The first second is warmup and is left out of every figure.

- **mix** is `FrameCost.mixMs`: the blits sync plus pulling the channels the CPU folds.
- **draw** is `FrameCost.drawMs`: the canvas work on the CPU. GPU work finishes after it returns,
  so on WebGL and WebGPU only fps and the frame gaps (p50, p95) show the GPU's own time.

Every run's record goes to `bench/runs/<time>-<backend>-<lights>.json` (gitignored). It holds every
frame's raw mix and draw times, the machine, load, Chrome version, GPU adapter, and the bree and
blits commits. On a fleet node the blits commit names the node's checkout, which onto syncs newer
files over: the runs below record blits `dd75131` but built the files of `1919a94`. The sweep
prunes the directory to the newest 200 records when it starts.
`node scripts/bench-digest.mjs <label>` prints one label's runs as the table below.

Timed runs go to a quiet fleet node with a GPU, not to a machine in use:

```
onto do --kind bench --solo --node teitou --task bree-gpu-bench --expect 6m \
  --out bench/runs --about "..." -- node scripts/bench.mjs --label <round>
```

## Results

teitou (Apple M5 Max, 18 cores), Chrome 156.0.8078.4, 1280 × 800 viewport at device pixel ratio
1, after round 2 on blits main `dd2d008` (2026-11-04), label `round-2b`. One run per row.

| lights | backend |    fps | p50 ms | p95 ms | mix ms | draw ms | fps after round 1 |
| -----: | :------ | -----: | -----: | -----: | -----: | ------: | ----------------: |
|  1,000 | 2D      | 1413.2 |   0.70 |   0.90 |   0.28 |    0.38 |            1396.6 |
|  1,000 | WebGL   | 1027.4 |   0.40 |   2.30 |   0.26 |    0.67 |             726.8 |
|  1,000 | WebGPU  | 7608.0 |   0.10 |   0.20 |   0.01 |    0.01 |            2213.3 |
|  4,000 | 2D      |  366.4 |   2.80 |   3.10 |   1.06 |    1.59 |             372.6 |
|  4,000 | WebGL   |  730.0 |   1.40 |   1.60 |   0.97 |    0.35 |             750.4 |
|  4,000 | WebGPU  | 8284.4 |   0.10 |   0.20 |   0.01 |    0.04 |             623.8 |
| 20,000 | 2D      |   56.5 |  17.50 |  21.90 |  10.95 |    6.62 |              53.8 |
| 20,000 | WebGL   |  109.2 |   9.00 |  11.20 |   7.68 |    1.39 |             113.9 |
| 20,000 | WebGPU  | 6212.4 |   0.10 |   0.30 |   0.02 |    0.08 |              61.1 |
| 80,000 | 2D      |   14.8 |  65.40 | 100.20 |  42.50 |   24.94 |              15.6 |
| 80,000 | WebGL   |   19.8 |  50.70 |  57.90 |  46.07 |    4.47 |              20.4 |
| 80,000 | WebGPU  | 3749.1 |   0.20 |   0.40 |   0.04 |    0.13 |              13.8 |

What the table says:

- **WebGPU's frame is all on the GPU.** Its mix and draw together cost the CPU under 0.2 ms a frame
  at 80,000 lights, against about 47 ms on 2D and 50 ms on WebGL. Frames are uncapped, so its fps
  is how fast the GPU finishes them; a display shows at most its refresh rate. A count of animation
  frames in the page itself agreed: 2,656 a second at 20,000 lights on a local machine.
- **2D and WebGL are unchanged** within run-to-run noise: they fold on the CPU, which round 2 did
  not touch, and most of their frame is blits's CPU fold from 20,000 lights up.
- **WebGL at 1,000 lights** stalls about 2 ms in its draw every few frames, in round 1 and round 2.
  The likely cause, inferred and not measured, is the GPU pushing back on frames queued ahead of it
  at over 700 fps, which a display-capped frame rate would not reach.

### Reading columns back (2026-11-04)

On WebGPU, reading `Marquee.columns` has the sign read its channels back from the GPU for the next
60 frames (`readChannels` in `src/render/attach.ts`, on blits's `gpuOf(m).read`). With the bench
page reading them every frame (`--read`, labels `columns-off` and `columns-read`, teitou), a frame
took 0.16 → 0.24 ms at 20,000 lights and 0.27 → 0.63 ms at 80,000, from 6,239.5 → 4,158.7 fps and
3,666.1 → 1,576.7 fps. A sign nothing reads pays none of it.

### Many small displays (2026-11-04)

The digits page (`lab/digits.ts`, `node scripts/bench.mjs --page digits`) draws digit-sized 5 × 7
signs with the sparkle and rainbow layers on WebGPU, either each on its own canvas (one ticker, one
device) or as one sign holding every digit's dots on one canvas. The shared sign holds about 40%
more lights, since it keeps a dot between digits. Label `digits-3`, teitou, after round 2.

| digits | way      |    fps | p50 ms | p95 ms | mix ms | draw ms |
| -----: | :------- | -----: | -----: | -----: | -----: | ------: |
|    100 | separate |   80.9 |  12.20 |  19.00 |   5.47 |    3.17 |
|    100 | shared   | 5520.7 |   0.20 |   0.30 |   0.11 |    0.02 |
|    500 | separate |   16.3 |  59.30 |  73.80 |  20.59 |   22.06 |
|    500 | shared   | 3451.7 |   0.20 |   0.50 |   0.21 |    0.03 |
|  1,000 | separate |    7.7 | 120.70 | 175.80 |  39.89 |   45.89 |
|  1,000 | shared   | 1805.6 |   0.30 |   2.20 |   0.48 |    0.03 |

Separate signs pay per sign on the CPU (each runs its own mix, encodes and submits its own GPU
work, and presents its own canvas), so their cost grows with the count of signs rather than of
lights. Many displays on one page should share one sign and one surface.

Segment readouts do (`docs/superpowers/specs/2026-11-04-segment-readouts-design.md`). The
`readouts` way lays the digits out as one-cell 7-segment readouts on one panel, 9 lights a digit,
and is measured here against the shared sign with no layers, since readouts take none yet
(`npm run bench:readouts`, label `readouts-1`, teitou, one run per row):

| digits | way      |    fps | p50 ms | p95 ms | mix ms | draw ms |
| -----: | :------- | -----: | -----: | -----: | -----: | ------: |
|    100 | shared   | 5956.2 |   0.20 |   0.30 |   0.10 |    0.02 |
|    100 | readouts | 6993.2 |   0.10 |   0.20 |   0.01 |    0.04 |
|    500 | shared   | 3359.1 |   0.20 |   0.50 |   0.21 |    0.03 |
|    500 | readouts | 3567.4 |   0.20 |   0.40 |   0.03 |    0.19 |
|  1,000 | shared   | 1791.1 |   0.30 |   2.40 |   0.49 |    0.02 |
|  1,000 | readouts | 2064.7 |   0.50 |   0.70 |   0.13 |    0.30 |

A readout's draw costs more than a dot's (each segment's quad covers its glow and its fragment
works out a distance), and its mix less (one value voice and no layers).

## Rounds

| round          | change                                                                                                           | cost                                                                       | gain                                                                                                                        |
| :------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| 1 (2026-11-04) | Cue a layer only while it is on (`src/layers.ts`)                                                                | 51 lines changed in `src/layers.ts`, one test                              | at 20,000 lights: 2D 23.8 → 53.8 fps, WebGL 27.8 → 113.9, WebGPU 23.7 → 61.1; at 80,000: 5.3 → 15.6, 5.9 → 20.4, 5.4 → 13.8 |
| 2 (2026-11-04) | On blits's phase 3, a scene's color, its modulators and its moves over part of the board take their shader forms | about 30 lines in `src/modulators/color.ts` and `src/pieces.ts`, two tests | WebGPU at 20,000 lights 72.2 → 6212.4 fps, at 80,000 14.4 → 3749.1; 500 shared digits 44.4 → 3451.7                         |

**Round 1.** A Chrome CPU profile of the 20,000-light mix (not kept) put most of the time in blits
visiting each voice's subjects, and a count of voices found every built-in layer cued, off ones at
weight 0. blits still visits a weight-0 voice's every subject each frame: in a local probe at 20,000
lights, a sign with no program and every layer off took 32 ms a frame to mix before this change and
1.8 ms after (a node script on a busy machine, not recorded). Now a layer is cued while its weight
is above 0 and faded out when it drops to 0. A layer turned on later is sought to where its loop
would have been, so it shows exactly what it did before (`test/marquee.test.ts`, "a layer turned on
late"). Layers also take a plain number for a weight instead of a `level` signal, which blits's gpu
engine refuses to fold.

**Round 2.** blits's phase 3 folds owner-held voices on the GPU, but a sweep on it alone (label
`round-2`) moved WebGPU nowhere: 72.2 fps at 20,000 lights. A CPU profile (not kept) put 95% of
the frame in pulling the one channel still on the CPU, `tint`, because each scene's color was a
plain function patch. A blits gpu engine folds a channel only when every voice writing it can run
there, and one plain patch keeps the whole channel on the CPU. The scene color now has a shader form
(`solid` in `src/modulators/color.ts`). The digits page then showed the same for effects with an
order, such as `hold`: a modulator inside an effect never took its shader form, and a move did only
when it covered every dot, a rule from before blits folded voices over part of its subjects
(`stagePiece` in `src/pieces.ts`). `test/gpu/marquee.gpu.ts` checks that scroll and hold pull
nothing on the CPU where blits folds owned voices over part of the board.

### Where tuning stops (2026-11-04)

WebGPU's frame no longer has CPU work worth a round: under 0.2 ms at 80,000 lights. What is left:

- **Effects that still fold on the CPU on WebGPU**: spreads by letter or at random, and the moves
  and modulators with no shader form (`TODO.md`, "GPU renderers").
- **2D and WebGL's mix** is blits's CPU fold, which bree calls but does not own.
- **2D drawing.** In Chrome CPU profiles (not kept), the drawing code's own time was 6.5% of a 2D
  frame at 80,000 lights; the rest of the draw was the canvas filling and blurring, which a round
  could change only by changing 2D's output, and this project holds that fixed.
