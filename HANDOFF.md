# Handoff

What a session picking up bree needs that the code and `TODO.md` don't already say. Written
2026-10-24.

## State

- `main` is about 40 commits ahead of `origin/main`, unpushed. Besides the labkit compose lab's
  polish, it holds proportional-by-default kerned text, effect params with scene tuning, the scene
  panel, resizable columns, and outline and shadow styles.
- **It can't push yet.** CI and Pages install `@weasel-js/*` from npm, and the lab uses API that
  exists only in the local `~/src/weasel` checkout: `.motif(stereo({ invert }))` in
  `lab/compose/hardware.ts`, `useUndoKeys`, and the label-tooltip help rendering. bree's fleet
  typecheck fails on exactly those, as expected. Pushing needs a weasel release (labkit and ui)
  and a bump here first.
- weasel `main` holds this work (labkit motif option, inline two-up default, stereo invert and
  spacing, `useUndoKeys`, row help on labels) on top of 100+ other sessions' unpushed commits.
  Releasing it is the user's call.

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
- Unanswered: whether `reverse` becomes a layer that follows the message or is dropped for the
  `invert` layer, and whether a tracking lever is still wanted now kerning is in.

- Every prefs setting carries a tooltip explanation, no ⓘ icons (all projects).
- Consumers of the user's own libraries build against the sibling checkout by default.
- `phase per step` is shown in τ, rates in Hz, shares in percent (display `scale`).
- Unanswered: which "layer motif" redesign the user meant (slot piece cards or the Layers
  panel), and whether to add a compound icon button (primary icon with an inset copy action)
  to weasel ui for the share buttons, which don't exist there yet.
