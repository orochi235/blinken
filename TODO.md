# TODO

- **Text effects as blits arcs.** blits is adding an `arc` (enter, active, exit voices whose `in`
  and `out` marks stand for klieg's `active` and `exit` events; asked 2026-10-22). Once it ships,
  split each text effect into those three parts, play a program as a queued span of arcs instead of
  `show.ts` adding up start times, and pin `@msb235/blits` to that release.
- **Subject labels for the blits panel.** `createMarquee` named each subject (`dot 3,4`, `cell 1`)
  through the mix's `labelOf`, which published blits 0.11.0 lacks. Put it back with the release
  that brings the arc.
- **A compose lab** (moved from blits's HANDOFF, 2026-10-22): a page for putting the effects
  together, its controls built from each effect's `params`.
- **CI on GitHub** fails until `@msb235/blits-panel` is published, since the lab imports it and
  the runner has no blits checkout beside it.
