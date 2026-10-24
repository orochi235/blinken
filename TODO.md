# TODO

## Known gaps

- The compose lab's step controls have no accessible names.
- In the compose lab, clicking a palette's colors row opens its first color picker, since the row is a label.
- The compose lab keeps one previous draft, so opening a second link loses the draft the first replaced.
- Browsing an effect in the compose lab's designer reassigns the picked step to it.
- `rate` means "lit at once" for `sparkle` but cycles per second for every other modulator.
- `hue` and `chroma` do nothing on a dot nothing tinted: `dotColor` returns the fallback color first.
- `src/modulators/flash.ts`'s header comment still says flash blinks once a second at its defaults; in an active slot with a hold it now flashes once per hold.
- The compose lab shows "one pass per hold" on a piece even when the effect has no hold, where it does nothing.
- The compose lab's "copy as code" prints link values as decoded, unclamped; staging clamps them.
- Reverse text has no lit row above or below its letters, since every face fills the sign's 7-row line, so reversed 5 × 7 letters read poorly; a border row would need a taller line.
- In the compose lab's narrow sign pane, a setting's value runs into the next setting's label ("140ROWS").
- Holding the scrubber on a resized sign plays on after the resize rather than staying held.
