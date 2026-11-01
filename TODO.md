# TODO

## Parked

- Authoring an effect's params in the designer: naming a param and picking the settings it changes. Parked 2026-10-24 as more than the lab needs for now; effects declare params in code, as the built-ins do. The section as built is in e294d8a (`lab/compose/designer/ParamsBox.tsx`).

## Known gaps

- A typing piece paced by input with an order of its own (not the effect's) staggers its dots past its rests, so at a rest the later dots are still behind; only the effect's order is folded into the stops (2026-10-26).
- On the effects page the diagram and the card designer share one scrolling column, so picking a node scrolls its card into view and carries the diagram off screen. Seen 2026-10-26 with HOLD's flash; fixing it means giving the cards a scroll pane of their own, or another layout.
- Duplicate copies ship in `WEASEL=npm` runs and the deployed lab: `@msb235/blits-panel@0.4.1` pins weasel `1.12.0` exactly, so npm nests weasel 1.12 under it beside bree's 1.15, and each weasel pins its own blits (1.15 → `0.12.0`, 1.12 → `0.11.0`) beside bree's `0.16.1`. Needs a blits-panel release on current weasel, and weasel taking blits as a range (2026-11-01).
- A scene's hold on an effect that has none still plays an active piece once over it, but the designer only offers that auto length when the effect itself has a hold.
- `wave` on a 7-row sign clips a letter's top or bottom row at each step, since the font leaves no spare rows; it reads cleanly from 9 rows up.
- `swarm` on a message about as wide as the sign fills it with in-flight dots, so the scatter reads as a haze rather than separate dots.
- `bounce-in` falls only within its own line's rows, not from the top of the sign, so on a tall sign it starts partway down.
