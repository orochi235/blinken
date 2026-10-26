# Effect diagram

**Status: not built (2026-10-26).** This designs the diagram the effects page is to compose
effects on; none of it exists yet. Steps land in the order below, and this doc gets cut down to the
unbuilt ones as each lands.

For whoever builds or extends the effects page (`lab/effects.html`). It answers what the diagram
draws, what dragging on it changes, and where its code lives.

## What it is

The effects page's right column, top to bottom: preview sign, playback, **diagram**, then the card
designer as it is now (`lab/compose/designer/`). The diagram is where an effect is composed; the
cards stay for each piece's settings (decided 2026-10-26, over an inspector column and over
settings opening on the nodes).

A switch in the diagram's title bar picks one of three views of the same effect. Opening an effect
starts in **both**; picking a node moves to the view that suits it (a modulator to signal, a step
to time); after that the switch is the user's and nothing changes it (2026-10-26).

| View   | Nodes                                                                   | Edges                                                         |
|--------|-------------------------------------------------------------------------|---------------------------------------------------------------|
| signal | each piece, labeled with its slot; a node per channel something writes; the sign | piece → each channel it writes; channel → sign        |
| time   | the enter, active and exit steps, each with its length; each step's pieces | step → step, labeled with the blend; step → its pieces     |
| both   | steps as containers holding their pieces; channels along the bottom      | the steps' sequence; piece → channel                          |

A piece's channels are its `writes` (`StagedPiece.writes`): a move writes `lit`, a modulator what
its definition names.

## What dragging changes

Each lands as its own step, in this order:

1. **Pick.** A node picked on the diagram scrolls the card designer to that piece or step and
   marks it; a card picked marks its node.
2. **Rewire.** A modulator that is one curve on one channel — the ease family (`dim`,
   `desaturate`, `flare`, …) and the wave family — gains a `channel` setting, its present channel
   the default, so no saved effect or link changes (2026-10-26, over swapping to a sibling
   modulator and over splitting curve from channel). Dragging its wire's end to another channel
   sets it. The choices are the channels that mix the same way as the default, which is the kit's
   channel type in `src/board.ts`: `gain`, `chroma` and `glow` (`mul`, resting at 1) with each
   other; `lit` and `invert` (`max`, 0 to 1) with each other; `hue` and `tint` alone. A modulator
   writing several channels, or one with its own logic (`sparkle`, `chase`, `glitch`), has its
   wires locked.
3. **Move between steps.** A piece dragged into another step moves to that slot. A move belongs to
   one slot (`MOVES[name].slot`), so dropping one elsewhere is refused and the refusal says why.
4. **Add and remove.** Delete takes out the picked piece; a piece dropped on a step from a palette
   of moves and modulators is added there.
5. **Reorder.** The pieces within a step reorder, which is their order in the slot's list.

## Where the code goes

- `lab/compose/designer/graph.ts` — pure: an effect and a view to `@weasel-js/diagram` data, with
  stable ids (`piece:enter:0`, `step:active`, `channel:glow`, `sign`).
- `lab/compose/designer/graphEdits.ts` — pure: a diagram edit to an effect edit, applied through
  `editEffect`, so undo and a built-in's copy on first change work as the cards' do.
- `lab/compose/designer/EffectDiagram.tsx` — the view, the switch, and the picked node shared with
  the cards.
- The two pure modules are unit-tested; each step is checked in a browser.

Where `@weasel-js/diagram` lacks what a step needs — a palette drop for step 4 is the likely one —
it is added to weasel as engine surface and released before bree depends on it. The lab already
builds against weasel's local `dist` and cannot push until a weasel release (`HANDOFF.md`); these
additions join that release.
