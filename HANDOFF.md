# Handoff

What a session picking up bree needs that the code and `TODO.md` don't already say. Written
2026-10-24.

## State

- Dependencies are on weasel `1.15.0`, blits `0.16.1`, blits-panel `0.4.1` and vitest 5 (2026-11-01).
  CI and Pages install those from npm; the lab and tests use the sibling checkouts where present.

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

- Every prefs setting carries a tooltip explanation, no ⓘ icons (all projects).
- Consumers of the user's own libraries build against the sibling checkout by default.
- `phase per step` is shown in τ, rates in Hz, shares in percent (display `scale`).
- Unanswered: which "layer motif" redesign the user meant (slot piece cards or the Layers
  panel), and whether to add a compound icon button (primary icon with an inset copy action)
  to weasel ui for the share buttons, which don't exist there yet.
