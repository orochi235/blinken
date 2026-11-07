# Changelog

This package follows [semver](https://semver.org): before 1.0.0 a breaking change bumps the minor
version, and anything else the patch. Each release lists its changes as **Breaking**, **Added** and
**Fixed**, and the release workflow refuses a tag with no section here.

## Unreleased

**Added**

- Readouts take a `transition` for how `set` moves them to a new value: `fade`, `scramble`,
  `count`, `wipe`, `flap` (each cell steps through the alphabet, as a split-flap board's cards do) or
  `roll` (each digit rolls up, as an odometer's wheels do), from `TRANSITIONS`, or a `Transition` of
  your own; `transitionMs` sets how long, and `setTransition` changes it.

**Fixed**

- Lines of outlined or shadowed text no longer overlap: lines stand the rows a style adds further
  apart, both in a `\n`-separated message and in one repeated down a tall board. `Bitmap.pitch` gives
  the spacing.

## 0.2.0

**Breaking**

- A readout whose type spells letters or numbers is selectable by default, and on an overlay its
  cells now take the pointer. Pass `select: false` for an overlay readout over something clickable.

**Added**

- Readouts that spell can be selected and copied as text, with `selection` choosing how a selected
  cell shows (`glow`, `recolor`, `underline`, `invert` or `block`), exported as `Selection` and
  `SELECTIONS`, and `setSelection` to change it. `copy` picks the shown case or the value's own.
- `edit: true` makes a readout typed into, with `onInput`, `onKeyDown`, `onBlur`, `label`, `field`
  and `setField` for building a control from one.
- `lines` lays a readout out on several rows, word-wrapped unless `wrap: false`.

**Fixed**

- A sign slower than 4 fps plays instead of rebasing every frame.
- A WebGL sign made while every slot is taken draws once a slot frees.
- A followed sign is laid out on repaint and `setHighlight` alike.
- WebGPU no longer allocates per frame for its plan, channels, picks and bulb list.

## 0.1.0

The first release: `createMarquee` and its effects, layers and hardware, the WebGPU, WebGL 2 and 2D
renderers, segment readouts, and `<blinken-player>` for pages with no build step.
