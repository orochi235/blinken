# TODO

## Parked

- Authoring an effect's params in the designer: naming a param and picking the settings it changes. Parked 2026-10-24 as more than the lab needs for now; effects declare params in code, as the built-ins do. The section as built is in e294d8a (`lab/compose/designer/ParamsBox.tsx`).

## Known gaps

- On the effects page in a window 1200px wide or less, the diagram and the card designer still share one scrolling column, so picking a node scrolls its card into view and carries the diagram off screen; wider, the designer has a column of its own (2026-11-01).
- Duplicate copies ship in `WEASEL=npm` runs and the deployed lab: `@msb235/blits-panel@0.4.1` pins weasel `1.12.0` exactly, so npm nests weasel 1.12 under it beside bree's 1.15, and each weasel pins its own blits (1.15 → `0.12.0`, 1.12 → `0.11.0`) beside bree's `0.16.1`. Needs a blits-panel release on current weasel, and weasel taking blits as a range (2026-11-01).
- `wave` on a 7-row sign clips a letter's top or bottom row at each step, since the font leaves no spare rows; it reads cleanly from 9 rows up.
- `swarm` on a message about as wide as the sign fills it with in-flight dots, so the scatter reads as a haze rather than separate dots.
