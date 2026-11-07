# Handoff

What a session picking up blinken needs that the code and `TODO.md` don't already say. Written
2026-10-24, updated 2026-11-05.

## State

- Dependencies are on weasel `1.16.1`, blits `^1.0.0`, blits-panel `0.9.0` and vitest 5 (2026-11-04).
  CI and Pages install those from npm; the lab and tests use the sibling checkouts where present.
- The GPU renderers and segment readouts are merged to `main`. How they work and what they
  measured is in `docs/gpu-renderers.md` and `docs/readouts.md`; what's left is in `TODO.md`.
- A fleet node's stale `../blits` sibling can fail move-shader tests that pass on npm blits 1.0
  (seen 2026-11-04 on a node other than msb-uai, which passed); pin `--node` when a GPU run
  must match.

## How the lab runs

- `weasel.config.ts` serves `@weasel-js/*` from `~/src/weasel`'s built `dist` by default
  (`WEASEL=npm` opts out), as `blits.config.ts` does for blits. A package changed in weasel
  needs `npm run build -w @weasel-js/<pkg>` before the lab sees it, and another session's stale
  `dist` can break the lab with "does not provide an export named …"; rebuild that package.
- `store.ts` keeps its state and the attached sign in `import.meta.hot.data`, so hot reloads keep
  the sign attached.

- `npm run forge` serves the forge workshop (`@weasel-js/forge`) on port 4887: each piece alone, with
  controls, from the stories in `forge/stories`. Like the lab, it serves weasel from the checkout
  beside blinken, plugin included, so the two halves of forge always match.

## Decisions made in conversation

- Every piece of UI made here, library or lab, gets a forge story in `forge/stories` in the same
  change (2026-11-06).
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
- A sign on a light page uses `housing: 'clear'`: unlit sockets are a gray veil standing out from
  white and black by the same L*, and lights go over it. No `light` housing and no blend-mode
  attribute; a backing or a blend is the page's CSS (2026-11-05).
- GPU work is done by the `excelsior` rule: as fast and functional as it reasonably can be, then
  stop (2026-11-03).

- Every prefs setting carries a tooltip explanation, no ⓘ icons (all projects).
- Consumers of the user's own libraries build against the sibling checkout by default.
- `phase per step` is shown in τ, rates in Hz, shares in percent (display `scale`).
- Unanswered: which "layer motif" redesign the user meant (slot piece cards or the Layers
  panel), and whether to add a compound icon button (primary icon with an inset copy action)
  to weasel ui for the share buttons, which don't exist there yet.
