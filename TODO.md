# TODO

## Asked for, not built yet

- A tracking lever on the font panel. Proportional spacing already fixes most of the faces' own spacing, so ask whether it is still wanted before building it (asked 2026-10-24).
- Outlines and block shadows as font layers, added around or behind the letters programmatically (asked 2026-10-24).

## Known gaps

- The compose lab no longer offers `style.reverse`, which is to become a layer (asked 2026-10-24); a scene that already has it still draws reversed, with no switch to turn it off. The `invert` layer swaps the whole sign, while `reverse` lights only the message's box, following it as it moves.
- The compose lab's scene controls have no accessible names.
- In the compose lab, clicking a palette's colors row opens its first color picker, since the row is a label.
- The compose lab keeps one previous draft, so opening a second link loses the draft the first replaced.
- Browsing an effect in the compose lab's designer reassigns the picked scene to it.
- `rate` means "lit at once" for `sparkle` but cycles per second for every other modulator.
- `hue` and `chroma` do nothing on a dot nothing tinted: `dotColor` returns the fallback color first.
- `src/modulators/flash.ts`'s header comment still says flash blinks once a second at its defaults; in an active slot with a hold it now flashes once per hold.
- The compose lab shows "one pass per hold" on a piece even when the effect has no hold, where it does nothing.
- The compose lab's "copy as code" prints link values as decoded, unclamped; staging clamps them.
- Reverse text has no lit row above or below its letters, since every face fills the sign's 7-row line, so reversed 5 × 7 letters read poorly; a border row would need a taller line.
- In the compose lab's narrow sign pane, a setting's value runs into the next setting's label ("140ROWS").
- Holding the scrubber on a resized sign plays on after the resize rather than staying held.
- `biome check lab/compose` fails on `ShareBar.tsx`'s `role="group"` div (`lint/a11y/useSemanticElements` wants a `<fieldset>`).
- `@msb235/blits-panel@0.1.1` pins weasel `1.12.0` exactly, so with bree on `1.13.0-rc.0` npm nests a second weasel copy under it; `WEASEL=npm` runs and the deployed lab ship both. Needs a blits-panel release on the RC.
- `weasel.config.ts` serves the weasel checkout's `dist` whenever `labkit/dist` exists, however stale: a labkit build older than a ui export rename broke the compose lab with a 500 on 2026-10-24. It could warn when a package's `dist` is older than its `src`.
