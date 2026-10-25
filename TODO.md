# TODO

## Asked for, not built yet

- A tracking lever on the font panel. Proportional spacing already fixes most of the faces' own spacing, so ask whether it is still wanted before building it (asked 2026-10-24).

## Parked

- Authoring an effect's params in the designer: naming a param and picking the settings it changes. Parked 2026-10-24 as more than the lab needs for now; effects declare params in code, as the built-ins do. The section as built is in e294d8a (`lab/compose/designer/ParamsBox.tsx`).

## Known gaps

- The compose lab no longer offers `style.reverse`, which is to become a layer (asked 2026-10-24); a scene that already has it still draws reversed, with no switch to turn it off. The `invert` layer swaps the whole sign, while `reverse` lights only the message's box, following it as it moves.
- Reverse text has no lit row above or below its letters, since every face fills the sign's 7-row line, so reversed 5 × 7 letters read poorly; a border row would need a taller line.
- `@msb235/blits-panel@0.1.1` pins weasel `1.12.0` exactly, so with bree on `1.13.0-rc.0` npm nests a second weasel copy under it; `WEASEL=npm` runs and the deployed lab ship both. Needs a blits-panel release on the RC.
- A tint covering a dot partly is laid over black rather than the message's own color, so a half-covered dot shows a darker tint instead of a blend (`dotColor` in `src/color.ts`).
- `weasel.config.ts`'s stale-build warning counts every file under a package's `src`, tests included, so editing a test there warns too.
- A scene's hold on an effect that has none still plays an active piece once over it, but the designer only offers that auto length when the effect itself has a hold.
- "Copy as code" clamps a scene's tuning to its ranges but still prints a value of the wrong kind, which tuning ignores when it plays.
- A pointer-cancel on the scrubber ends its drag but leaves the sign held.
