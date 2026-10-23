# TODO

- **Pin `@msb235/blits` to the release with `mix.arc`, and restore subject labels.** Effects
  now play as blits arcs, which published blits 0.11.0 lacks. Once that release ships, pin to it
  and put back `createMarquee`'s per-subject names (`dot 3,4`, `cell 1`) through the mix's
  `labelOf`.
- **A compose lab** (moved from blits's HANDOFF, 2026-10-22): a page for putting the effects
  together, its controls built from each effect's `params`.
- **CI on GitHub** fails until `@msb235/blits-panel` is published, since the lab imports it and
  the runner has no blits checkout beside it.
