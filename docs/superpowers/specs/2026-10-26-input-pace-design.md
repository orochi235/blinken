# Pace by input

**Status: designed 2026-10-26, being built the same day.** When it lands, what a reader needs moves
to the README and this file is deleted.

For whoever extends bree's moves or binds a sign to input. It answers how a sign waits for a key
press before each typed letter, and what a move declares so it can.

## What it does

`type-on` and `type-off` take a **pace** setting: `time` (the default, as before) or `input`. Paced
by input, the sign holds at each letter and moves on when the host calls `step()` on it; the lab's
preview calls `step()` on a key press. It waits as long as it takes (decided 2026-10-26). Layers
keep moving while it waits, since they run on the mix clock, not the pass's.

## What a move declares

A move that can be paced by input has `rests(at, p)`: where in its own time it waits, and where it
plays on from after the last wait, or `null` when its settings pace it by time.

```ts
interface Rests {
  readonly at: readonly number[];
  readonly release: number;
}
```

`type-on`, with `n` letters at `ms` each, rests at `ms/2 + k·ms` for `k` from 0 to `n − 1` — the
cursor showing and `k` letters down — and releases at `n·ms`, where the last letter is down and the
cursor's blink plays on. The rests sit mid-letter, so a frame that runs a little past one never
shows the next letter early. `type-off` mirrors it: it rests with the whole message and the cursor
on, then one letter fewer at each press, and releases with none left.

## How it is carried

- `stagePiece` puts a piece's rests on its `StagedPiece`.
- `stageEffect` turns each into **stops** on the owner's clock: the arc's start plus the slot's
  start plus the rest. Every arc's stops are merged in time order, so an order lag interleaves its
  groups' letters.
- `layOut` places each scene's stops in pass time, as `stops` beside `scenes` and `length`.

```ts
interface Stop {
  readonly at: number;
  readonly release?: true;
}
```

## What a press does

| The pass is…                        | `step()`                                      |
| ----------------------------------- | --------------------------------------------- |
| playing, before a rest              | nothing; on reaching the rest, it holds there |
| held at a rest, next stop a rest    | jumps to that rest and holds                  |
| held at a rest, next stop a release | jumps to the release and plays on             |
| anywhere else                       | nothing                                       |

It jumps rather than plays on, so a letter appears on the press, not a letter's time after it. A
seek or a restart drops the hold; a looping program waits again on its next pass. The scrubber and
thumbnails go on showing the nominal timing.

A move whose dots travel between rests would look choppy jumping and would want to play to the next
rest instead. Not built: only the typing moves take a pace.
