# Handoff

What a session picking up bree needs that the code and `TODO.md` don't already say. Written
2026-10-24, updated 2026-11-04.

## State

- Dependencies are on weasel `1.16.1`, blits `^1.0.0`, blits-panel `0.9.0` and vitest 5 (2026-11-04).
  CI and Pages install those from npm; the lab and tests use the sibling checkouts where present.
- An audit on 2026-11-01 fixed what it found; what it left is in `TODO.md`. `main` is ahead of
  `origin` and unpushed.
- The GPU renderers (WebGPU, WebGL 2, 2D) are built on branch `gpu-renderers` in the worktree
  `~/src/bree-gpu`, unmerged (2026-11-04). Everything it needs from blits shipped in 1.0.0.
  What's left is in `TODO.md`, how it works and what it measured in `docs/gpu-renderers.md`, how
  to use it in the README's GPU section. After round 2 on blits phase 3, WebGPU's frame is all on
  the GPU for effects with a shader form; see `docs/gpu-renderers.md`.

## How the lab runs

- `weasel.config.ts` serves `@weasel-js/*` from `~/src/weasel`'s built `dist` by default
  (`WEASEL=npm` opts out), as `blits.config.ts` does for blits. A package changed in weasel
  needs `npm run build -w @weasel-js/<pkg>` before the lab sees it, and another session's stale
  `dist` can break the lab with "does not provide an export named …"; rebuild that package.
- `store.ts` keeps its state and the attached sign in `import.meta.hot.data`, so hot reloads keep
  the sign attached.

## Decisions made in conversation

- Proportional is the default and `monospace` the switch; old links and files still read as
  monospace (2026-10-24).
- Kerned letters keep a blank from each other diagonally too, not only across (2026-10-24).
- Effects declare params in code; authoring them in the designer is parked (see `TODO.md`,
  2026-10-24).
- Outline means hollow letters; shadow is a dim copy one dot down and right, and the two stack
  (2026-10-24).
- Reverse text is dropped for the `invert` layer; old links and files that reversed a scene
  open with that layer on (2026-10-24).
- Tracking is wanted alongside kerning: whole blank columns, −1 to 6 (2026-10-24).
- Three backends, WebGPU, WebGL 2 and 2D; the GPU ones may look better than 2D (2026-11-03).
- The WebGPU device is created once and passed to each sign, not found by each sign
  (2026-11-03).
- GPU work is done by the `excelsior` rule: as fast and functional as it reasonably can be, then
  stop (2026-11-03).

- Every prefs setting carries a tooltip explanation, no ⓘ icons (all projects).
- Consumers of the user's own libraries build against the sibling checkout by default.
- `phase per step` is shown in τ, rates in Hz, shares in percent (display `scale`).
- Unanswered: which "layer motif" redesign the user meant (slot piece cards or the Layers
  panel), and whether to add a compound icon button (primary icon with an inset copy action)
  to weasel ui for the share buttons, which don't exist there yet.
