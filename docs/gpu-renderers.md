# GPU renderers: benchmark and rounds

For whoever works on how fast bree draws. It answers: what a frame costs on each backend (2D,
WebGL, WebGPU) as the light count grows, what each round of tuning bought, and where tuning
stopped and why. The design lives in
[the spec](superpowers/specs/2026-11-03-gpu-renderers-design.md).

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
1, after round 1 (2026-11-04). The 1,000-light rows average two runs.

| lights | backend |    fps | p50 ms | p95 ms | mix ms | draw ms | fps before round 1 |
| -----: | :------ | -----: | -----: | -----: | -----: | ------: | -----------------: |
|  1,000 | 2D      | 1396.6 |   0.70 |   0.90 |   0.26 |    0.36 |              908.9 |
|  1,000 | WebGL   |  726.8 |   0.40 |   2.75 |   0.25 |    0.88 |              894.5 |
|  1,000 | WebGPU  | 2213.3 |   0.45 |   0.55 |   0.38 |    0.02 |             1202.4 |
|  4,000 | 2D      |  372.6 |   2.70 |   3.10 |   1.05 |    1.56 |              219.3 |
|  4,000 | WebGL   |  750.4 |   1.30 |   1.50 |   0.97 |    0.32 |              348.1 |
|  4,000 | WebGPU  |  623.8 |   1.60 |   1.90 |   1.51 |    0.05 |              276.3 |
| 20,000 | 2D      |   53.8 |  17.90 |  22.60 |  12.15 |    6.30 |               23.8 |
| 20,000 | WebGL   |  113.9 |   8.50 |  11.20 |   7.45 |    1.24 |               27.8 |
| 20,000 | WebGPU  |   61.1 |  16.30 |  18.50 |  16.06 |    0.21 |               23.7 |
| 80,000 | 2D      |   15.6 |  61.50 |  92.90 |  40.77 |   22.94 |                5.3 |
| 80,000 | WebGL   |   20.4 |  48.90 |  55.90 |  44.92 |    4.06 |                5.9 |
| 80,000 | WebGPU  |   13.8 |  71.50 |  77.20 |  71.77 |    0.63 |                5.4 |

What the table says:

- **The mix is most of the frame** from 20,000 lights up: all of it on WebGPU, nine tenths on
  WebGL, and two thirds on 2D at 80,000 lights. What a frame takes beyond its mix (p50 gap less
  mean mix) at 80,000 lights is 20.7 ms on 2D, 4.0 ms on WebGL and none measurable on WebGPU.
- **2D's draw at 80,000 lights** read 22.94 ms here against 16.00 ms in the baseline, though round 1
  changed nothing it draws. The row was not repeated.
- **WebGPU's mix costs more than the CPU mixer's** today. blits's gpu engine folds a channel on
  the GPU only when every voice writing it can run there. A scene's move is held by its scene's
  owner, which blits does not yet fold on the GPU, so `lit` stays on the CPU. The shader patches
  bree stages for WebGPU then run their CPU versions, which cost more than the plain patches the
  other backends use.
- **WebGL at 1,000 lights** stalls about 2 ms in its draw every second to fourth frame, in two runs
  of the records. The likely cause, inferred and not measured, is the GPU pushing back on frames
  queued ahead of it at over 700 fps, which a display-capped frame rate would not reach.

## Rounds

| round          | change                                            | cost                                          | gain                                                                                                                        |
| :------------- | :------------------------------------------------ | :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| 1 (2026-11-04) | Cue a layer only while it is on (`src/layers.ts`) | 51 lines changed in `src/layers.ts`, one test | at 20,000 lights: 2D 23.8 → 53.8 fps, WebGL 27.8 → 113.9, WebGPU 23.7 → 61.1; at 80,000: 5.3 → 15.6, 5.9 → 20.4, 5.4 → 13.8 |

**Round 1.** A Chrome CPU profile of the 20,000-light mix (not kept) put most of the time in blits
visiting each voice's subjects, and a count of voices found every built-in layer cued, off ones at
weight 0. blits still visits a weight-0 voice's every subject each frame: in a local probe at 20,000
lights, a sign with no program and every layer off took 32 ms a frame to mix before this change and
1.8 ms after (a node script on a busy machine, not recorded). Now a layer is cued while its weight
is above 0 and faded out when it drops to 0. A layer turned on later is sought to where its loop
would have been, so it shows exactly what it did before (`test/marquee.test.ts`, "a layer turned on
late"). Layers also take a plain number for a weight instead of a `level` signal, which blits's gpu
engine refuses to fold.

### Where tuning paused (2026-11-04)

Tuning paused for scope, not because returns had fallen off. Round 1 bought 2.3× to 4.1× at
20,000 lights, and the next candidate measured would cut WebGPU's mix by about 40%.

- **Plain patches on WebGPU while `lit` stays on the CPU.** Staging plain patches instead of shader
  patches on WebGPU took it from 70 to 115 fps at 20,000 lights, its mix from 13.9 to 8.3 ms, level
  with WebGL's. That was a local comparison on a busy machine (records labeled `probe-r2-before`
  and `probe-r2-plainall`, in that machine's gitignored `bench/runs/` until pruned), so the ratio
  is the finding, not the times. The comparison changed two lines; shipping it means either staging plain patches on WebGPU
  everywhere, which undoes the move and modulator shaders until blits folds owners, or choosing
  per channel in bree, which copies blits's eligibility rules. It was not taken because blits's
  phase 3, folding owner-held voices on the GPU, is landing and is expected to make the shader
  patches the faster path.
- **The CPU fold itself.** In Chrome CPU profiles of the bench page (not kept), most of the 2D and
  WebGL mix sat in blits's fill engine, which bree calls but does not own.
- **2D drawing.** In the same profiles, the drawing code's own time was 6.5% of a 2D frame at 80,000
  lights; the rest of the draw was the canvas filling and blurring, which a round may not change.

A round 2 sweep follows once blits's owner support lands, to see where WebGPU's mix then stands
against WebGL's.
