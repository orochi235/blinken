# Pieces, effects and programs: design

**Built** (2026-10-22). For whoever works on bree's composable effects and its compose lab.
It answers: what are the small parts an effect is made from, how do they make an effect, and how
do effects make a sign program.

## Intent

Mike wants to design marquee effects out of smaller pieces, then put those effects together into a
whole sign program, in a lab page and in code alike (2026-10-22). Today each text effect is one
hand-written patch: `hold` alone wipes on, stands, flashes and wipes off. None of that can be
reused or recombined.

blits now has the means: `mix.arc({ enter, active, exit, hold, blend })` (blits `2a98ed7`,
unreleased) plays three parts that hand over on one clock, each part one voice or several layered.
klieg's `fire({ enter, active, exit })` has the same shape, and bree lines up with it on purpose.

## The three levels

| Level       | What it is                                                             | In blits                                                                                      | Example                                   |
| ----------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **piece**   | One thing dots do, in one order, during one part of an arc             | one `ArcVoice`: a patch, a `stagger`, a `duration`                                            | letters unfold, one letter after the next |
| **effect**  | Pieces placed in `enter`, `active` and `exit`, with a hold and a blend | one `ArcSpec`                                                                                 | `flip` = unfold · tumble · fold           |
| **program** | Messages, each played with an effect, one after another, under layers  | an owner holding one owner per step, each holding that step's arcs, plus looping layer voices | the lab's seven-message show              |

### Pieces

A piece is a **move** played in an **order**.
- **A move** is what a dot does over the piece's time, given the message's bitmap, the board and
  the move's settings. Each move is written for one slot: an _in_ move ends showing the message, an
  _out_ move starts showing it and ends blank, an _active_ move shows it the whole time.
- **An order** is the piece's `stagger`: when each dot starts the move. Orders are shared by every
  move: `together`, `column` (left to right, or right to left), `center` (out from the middle),
  `letter` (one letter after the next), `random` (from a hash of the column). Each takes a lag in ms.

Moves come out of today's six effects:

| Move                   | Slot     | From                              | Settings                              |
| ---------------------- | -------- | --------------------------------- | ------------------------------------- |
| cut on / cut off       | in / out | hold's wipe (with order `column`) | —                                     |
| unfold / fold          | in / out | flip                              | fold time                             |
| drop in / drop out     | in / out | fall                              | drop time                             |
| reel in / roll away    | in / out | roll                              | spin, glyphs passed                   |
| scroll in / scroll out | in / out | scroll's two halves               | column time, direction                |
| stand                  | active   | hold                              | —                                     |
| tumble                 | active   | flip                              | turns                                 |
| scroll across          | active   | scroll                            | column time, direction                |
| tile                   | active   | tile                              | tilt, column time, gaps, brick offset |
| flash                  | active   | hold                              | flashes                               |

**An order can apply inside a piece or to the whole effect.** Inside a piece it is that voice's
`stagger`. Applied to the whole effect, the effect is staged as one arc per group (per letter, per
column), each on its own clock, started a lag apart under one owner. So letter 0 tumbles while
later letters are still unfolding, as `flip` does today. A blits owner takes no stagger, which is
why this is done with several arcs. Hold's flash sweeping by column and fall's columns each
arriving and leaving on their own come out the same way.

### Planes and channels

A plane is blits's word for a group of a kit's channels that belong together (vocabulary,
2026-10-22). blits folds by channel and never reads planes, so bree declares and checks them. Every
piece says which planes it writes. The sign's kit grows from two channels to these:

| Plane      | Channel        | Folds by                | What it holds                                            |
| ---------- | -------------- | ----------------------- | -------------------------------------------------------- |
| shape      | `lit`          | `max`                   | whether a dot is part of what is drawn, 0 to 1           |
| brightness | `gain` (new)   | `mul`, rest 1           | how bright it is, so a piece can darken as well as light |
| color      | `tint`         | color average by weight | its color, set outright                                  |
| color      | `hue` (new)    | `sum`, rest 0, wrapping | a turn of the hue, relative to `tint`                    |
| color      | `chroma` (new) | `mul`, rest 1           | how saturated, relative to `tint`                        |
| glow       | `glow` (new)   | `mul`, rest 1           | how far a dot's light blooms around it                   |

A dot shows `tint`, turned by `hue` and saturated by `chroma`, at `lit × gain`, with a halo
scaled by `glow`. Today the renderer blurs every lit dot alike; a per-dot `glow` means drawing
each dot's halo into the blurred layer at its own strength. Dot size stays fixed (Mike,
2026-10-22). Pieces on
different planes layer without colliding: `stand` with `flash` in `active` gives today's hold. Two
pieces on the same channel fold by its rule; the staging function warns where two pieces in one
slot set `tint` outright, since averaging two colors is rarely what was meant.

### Two kinds of piece

- **Moves** draw the message on the shape plane, as in the table above. They know the bitmap.
- **Modulators** drive one channel, `lit` included (sparkle and chase light dots nothing else does) by a **curve** over time, **spread** over the sign by an order.
  They don't know the message; they change whatever is drawn. A modulator is a channel, a curve
  (blits's `wave` shapes, sine, triangle, saw and square, with cycles and phase; or a named easing
  curve for one-way ramps), a depth, and an order, which here gives each dot its phase.

| Modulator               | Channel  | Curve                            | Spread                        |
| ----------------------- | -------- | -------------------------------- | ----------------------------- |
| flash                   | `gain`   | square                           | together                      |
| blink, pulse, breathe   | `gain`   | square / triangle / sine         | together, or by letter        |
| rainbow (today's layer) | `hue`    | saw                              | by column                     |
| color sweep             | `hue`    | saw                              | center out, by row, by letter |
| palette step            | `tint`   | stepped through a list of colors | together, by letter, random   |
| two-color pulse         | `tint`   | sine between two colors          | any                           |
| fade to gray, flare     | `chroma` | easing                           | together                      |
| bloom pulse, flare      | `glow`   | sine / easing                    | together, or by letter        |
| chase (today's layer)   | `lit`    | square                           | by border cell                |
| sparkle (today's layer) | `lit`    | random flicker                   | random                        |

Today's three layers are modulators that happen to loop under the whole program. So a **layer**
becomes a place a modulator plays, under the program or inside one effect's slot, not a separate
kind of thing. Planes are not layers: a layer plays on planes like any piece.

### Effects

An effect is data:

```ts
const flip: EffectSpec = {
  name: 'flip',
  enter: { move: 'unfold', order: { by: 'letter', lag: 90 } },
  active: { move: 'tumble', params: { turns: 2 } },
  exit: { move: 'fold', order: { by: 'letter', lag: 90 } },
  hold: 3000,
  blend: 0,
};
```

Each slot takes one piece or a list of them, layered, the same as `ArcPart`. The six built-ins are
rebuilt as `EffectSpec`s made of pieces, so a built-in and an effect designed in the lab take one
path. Today's `TextEffect.stage()` and the hand-written patches it returns go away.

Staging an effect, meaning turning it into an `ArcSpec` for a message, a color and a board, is one
function. It computes each piece's `duration` from its move's length plus its order's largest
stagger, which `ArcVoice.duration` exists for.

### Programs

```ts
interface Step {
  readonly text: string;
  readonly hex: number;
  readonly effect: EffectName | EffectSpec;
  readonly hold?: number; // overrides the effect's
}
```

`play(mix, board, steps)` cues a program owner, and under it one owner per step that fits the
board, each placed where the step before it ends and holding that step's arcs. Not a queued span
(2026-10-22): a span places its children itself, so it cannot hold the per-letter arcs a
whole-effect order starts a lag apart. Every step's hold is finite, so its length is known when
it is staged. Under the program play any number of modulators looping as
layers, each with a weight and its settings; the built-in layers are `sparkle`, `chase` and
`rainbow`. `createMarquee` takes `effects` (a name
→ `EffectSpec` table added to the built-ins), so a program can name effects designed elsewhere.

## The compose lab

A second lab page, `lab/compose.html`, beside the current demo page, which stays as it is.
- **Effect designer.** Pick an effect to edit, or start a new one. Each slot (enter, active,
  exit) lists its pieces. A move shows its order, lag and settings; a modulator shows its channel,
  curve, depth and spread. All of the controls are built from the pieces' `params` data. Add a piece to layer it. Hold and blend are
  sliders. A sign previews the effect looping on a sample message.
- **Program.** Steps as a list: text, color, which effect, an optional hold. Add, remove,
  reorder. Layers are modulators under the program, with on/off and their own sliders; this needs
  `setLayer(name, on, params)` on `createMarquee`.
- **Every edit restarts from the step being edited**, so a change shows at once. "Solo" loops
  one step.
- **Export:** "copy as code" gives the effects and the program as a `createMarquee` call. "Copy
  link" puts the whole composition in the URL hash, as klieg's `/show/` page does. The current
  draft is kept in browser storage, so a reload doesn't lose it; it is a convenience, not a save.

## Goals, non-goals, anti-goals

- **Goal:** every built-in is reproducible in the lab from pieces, and a new effect needs no code.
- **Goal:** an effect is plain JSON-able data, so it round-trips through a link and through code.
- **Non-goal:** user-written moves in the lab. New moves are code; the lab composes existing ones.
- **Non-goal:** saving compositions anywhere but the link, the clipboard and the browser's storage.
- **Anti-goal:** the lab and `createMarquee` reading effects two different ways. One staging
  function serves both.
- **Anti-goal:** a hand-written patch surviving beside its piece version.

## Constraints

- Runs on blits `mix.arc`, unreleased. bree uses the `../blits` checkout until blits publishes;
  then it pins that version and restores `labelOf` (see `TODO.md`).
- An `'open'` hold is refused inside a span, so program steps always have a finite hold.
- Published source keeps relative imports; the lab and tests use the `@/` alias.

## Calls made without asking (2026-10-22), open to change

- **Rebuilt built-ins look like today's, not frame for frame.** Each keeps what makes it itself
  (flip's overlapping tumble, hold's sweeping flash, roll landing left to right); tests check
  the pieces, not pixels against the old patches.
- **An `active` piece with a length setting left unset plays one pass over the hold** (2026-10-22,
  replacing "loops at its own pass length"), so a built-in's look survives a step's hold override.
  Pieces that set their speed by `rate` (hue-cycle, pulse, bloom) still loop at it. `scroll across` lasts as long as its crossing, and
  is the default hold for an effect using it.
- **A brightness modulator darkens everything on its dots,** layers included, the way a real
  sign blanks its whole panel.
- **Text wider than the board clips** on centered moves, and the lab says so. `scroll in` ends
  where `stand` shows the message, so it hands over without a jump (2026-10-22).

## Left to the builder

The exact spelling of move and order names, how a move declares its slot, the lab's layout and
styling, and how settings that differ between pieces in one slot appear in the URL hash.
