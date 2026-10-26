# Effect diagram, step 1 (pick): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the open effect on the effects page as a diagram in three views (signal, time, both), with a picked node and the card designer kept in step.

**Architecture:** A pure `graphOf(spec, view, parts)` turns an effect into `@weasel-js/diagram` data, with stable node ids. `EffectDiagram` renders it with `DiagramView` and a view switch. The picked id lives in the designer's desk (`designer/open.ts`), so the diagram and the cards read and write one value. Spec: `docs/superpowers/specs/2026-10-26-effect-diagram-design.md`.

**Tech Stack:** React 19, `@weasel-js/diagram` and `@weasel-js/font` 1.13.0-rc.0 (served from `~/src/weasel`'s `dist` by `weasel.config.ts`), vitest (node environment, tests under `test/`).

**Rules for whoever runs this:** run bash with absolute paths or `git -C`, never `cd` (it moves the session). Commit each task by path, never `git add -A`. A whole-project `tsc` is refused on this machine; run it on the fleet: `onto do --kind typecheck --icon curlybraces --task typecheck-bree-diagram-pick --about "<why>" --expect 1m -- npm run typecheck`. A single test file runs locally.

---

## File map

| File | Job |
|---|---|
| `src/pieces.ts` | gains `writesOf(piece)`, the one answer to which channels a piece writes |
| `lab/compose/designer/staged.ts` (new) | stages the open effect on the preview text: part lengths and warnings by slot |
| `lab/compose/designer/graph.ts` (new) | `graphOf`, node ids, and which view suits a picked id |
| `lab/compose/designer/open.ts` | the desk gains `picked` |
| `lab/compose/designer/PieceCard.tsx`, `SlotBox.tsx`, `DesignerPanel.tsx`, `DesignerPanel.css` | cards show and set the pick |
| `lab/compose/designer/EffectDiagram.tsx`, `EffectDiagram.css` (new) | the diagram panel |
| `lab/effects/App.tsx` | places the diagram between playback and the designer |
| `test/pieces.test.ts`, `test/effect-graph.test.ts` (new), `test/designer-desk.test.ts` (new) | unit tests |

---

### Task 1: one answer to which channels a piece writes

**Files:** Modify `src/pieces.ts`; Test `test/pieces.test.ts`

- [ ] **Step 1: Write the failing test** (append inside the existing `describe('pieces', …)`, and add `writesOf` to the `@/pieces.js` import)

```ts
  it('says which channels a piece writes: a move lit, a modulator what it names', () => {
    expect(writesOf({ move: 'scroll-in' })).toEqual(['lit']);
    expect(writesOf({ mod: 'flare' })).toEqual(['glow']);
    expect(writesOf({ mod: 'glitch' })).toEqual(['hue', 'gain', 'invert']);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `/Users/mike/src/bree/node_modules/.bin/vitest run --root /Users/mike/src/bree test/pieces.test.ts`
Expected: FAIL, `writesOf` is not exported.

- [ ] **Step 3: Implement.** In `src/pieces.ts`, after `piecesOf`:

```ts
/** The channels a piece writes: a move draws the message on `lit`; a modulator writes what it names. */
export const writesOf = (piece: Piece): readonly Channel[] =>
  'mod' in piece ? MODULATORS[piece.mod].writes : ['lit'];
```

In `stagePiece`, replace `return { voice, writes: mod.writes, warnings: [] };` with `return { voice, writes: writesOf(piece), warnings: [] };` and `return { voice, writes: ['lit'], warnings };` with `return { voice, writes: writesOf(piece), warnings };`. Check `Channel` is imported in `pieces.ts` (it is used by `StagedPiece`), and export `writesOf` from `src/index.ts` beside `piecesOf`.

- [ ] **Step 4: Run it and watch it pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `src/pieces.ts src/index.ts test/pieces.test.ts`: "give the channels a piece writes one definition".

### Task 2: depend on the diagram packages

**Files:** Modify `package.json`, `package-lock.json`

- [ ] **Step 1:** `npm --prefix /Users/mike/src/bree install -D @weasel-js/diagram@1.13.0-rc.0 @weasel-js/font@1.13.0-rc.0`
- [ ] **Step 2:** `git -C /Users/mike/src/bree diff --stat`. Expected: only `package.json` and `package-lock.json`. Restore any lockfile churn unrelated to these two packages.
- [ ] **Step 3: Commit** both files: "depend on @weasel-js/diagram and @weasel-js/font for the effect diagram".

### Task 3: stage the open effect in one place

`DesignerPanel` stages the effect for its warnings; the diagram needs the same staging for part lengths. One helper serves both.

**Files:** Create `lab/compose/designer/staged.ts`; Modify `lab/compose/designer/DesignerPanel.tsx`

- [ ] **Step 1: Create `staged.ts`:**

```ts
import { useMemo } from 'react';
import {
  board,
  type EffectSpec,
  placeText,
  SIZE,
  type Slot,
  type Stretch,
  stageEffect,
  type Warning,
} from '@/index.js';

/** The sign the designer stages on: the shopfront size. */
const BOARD = board(SIZE.cols, SIZE.rows);

/** The open effect staged on the preview text: where each part plays, and warnings by slot. */
export interface Staged {
  parts: Readonly<Record<Slot, Stretch>> | null;
  warnings: ReadonlyMap<Slot | 'effect', readonly string[]>;
}

/** Stages `spec` on `text`; a spec that throws has no parts and its message as an effect warning. */
export function stagedOf(spec: EffectSpec, text: string): Staged {
  const warnings = new Map<Slot | 'effect', string[]>();
  let found: readonly Warning[];
  let parts: Staged['parts'] = null;
  try {
    const staged = stageEffect(spec, placeText(BOARD, text || ' '), 0xffffff);
    found = staged.warnings;
    parts = staged.parts;
  } catch (e) {
    found = [{ text: (e as Error).message }];
  }
  for (const w of found.filter((w) => w.rows === undefined))
    warnings.set(w.slot ?? 'effect', [...(warnings.get(w.slot ?? 'effect') ?? []), w.text]);
  return { parts, warnings };
}

/** `stagedOf` kept while the spec and text are the same. */
export const useStaged = (spec: EffectSpec | undefined, text: string): Staged | null =>
  useMemo(() => (spec ? stagedOf(spec, text) : null), [spec, text]);
```

- [ ] **Step 2: Use it in `DesignerPanel.tsx`.** Delete the `BOARD` constant and the `warnings` `useMemo`, drop the now-unused imports (`useMemo`, `board`, `placeText`, `SIZE`, `stageEffect`, `Warning`), and write `const warnings = useStaged(spec, text)?.warnings ?? new Map();`, importing `useStaged` from `./staged.js`. The rest of the panel reads `warnings.get(…)` unchanged.
- [ ] **Step 3: Lint:** `/Users/mike/src/bree/node_modules/.bin/biome check --write lab/compose/designer` (run from `/Users/mike/src/bree` through `git -C`-style absolute paths; biome reads `biome.json` from the working directory, so run it as `(cd /Users/mike/src/bree && ./node_modules/.bin/biome check --write lab/compose/designer)` in a subshell). Expected: no errors.
- [ ] **Step 4: Commit** `staged.ts DesignerPanel.tsx`: "stage the open effect in one helper the designer and the diagram share".

### Task 4: the graph

**Files:** Create `lab/compose/designer/graph.ts`; Test `test/effect-graph.test.ts`

- [ ] **Step 1: Write the failing test** `test/effect-graph.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { EffectSpec } from '@/index.js';
import { graphOf, idOf, partOf, viewFor } from '../lab/compose/designer/graph.js';

const fall: EffectSpec = {
  name: 'fall',
  enter: { move: 'drop-in' },
  active: [{ move: 'stand' }, { mod: 'flare' }],
  exit: { move: 'drop-out' },
  hold: 1700,
};
const parts = {
  enter: { start: 0, ms: 350 },
  active: { start: 350, ms: 1700 },
  exit: { start: 2050, ms: 350 },
};
const ids = (xs: readonly { id?: string }[]) => xs.map((x) => x.id);

describe('the effect graph', () => {
  it('round-trips its ids', () => {
    for (const part of [
      { kind: 'piece', slot: 'active', index: 1 },
      { kind: 'step', slot: 'exit' },
      { kind: 'channel', channel: 'glow' },
      { kind: 'sign' },
    ] as const)
      expect(partOf(idOf(part))).toEqual(part);
    expect(partOf('nonsense')).toBeNull();
  });

  it('draws signal flow: pieces into the channels they write, channels into the sign', () => {
    const g = graphOf(fall, 'signal', parts);
    expect(ids(g.nodes)).toEqual([
      'piece:enter:0', 'piece:active:0', 'piece:active:1', 'piece:exit:0',
      'channel:lit', 'channel:glow', 'sign',
    ]);
    expect(g.edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      'piece:enter:0>channel:lit', 'piece:active:0>channel:lit', 'piece:active:1>channel:glow',
      'piece:exit:0>channel:lit', 'channel:lit>sign', 'channel:glow>sign',
    ]);
    expect(g.nodes[0]?.lines).toEqual(['drop-in', 'enter']);
  });

  it('draws time flow: steps in sequence with their lengths, each with its pieces', () => {
    const g = graphOf({ ...fall, blend: 120 }, 'time', parts);
    expect(g.nodes.find((n) => n.id === 'step:active')?.lines).toEqual(['active', '1.70 s']);
    const seq = g.edges.filter((e) => e.from.startsWith('step:') && e.to.startsWith('step:'));
    expect(seq.map((e) => [e.from, e.to, e.label])).toEqual([
      ['step:enter', 'step:active', 'blend 120 ms'],
      ['step:active', 'step:exit', 'blend 120 ms'],
    ]);
    expect(g.edges.some((e) => e.from === 'step:active' && e.to === 'piece:active:1')).toBe(true);
    expect(g.nodes.some((n) => n.id.startsWith('channel:'))).toBe(false);
  });

  it('draws both: steps as containers holding their pieces, wired to channels', () => {
    const g = graphOf(fall, 'both', parts);
    expect(g.containers?.map((c) => [c.id, c.members])).toEqual([
      ['step:enter', ['piece:enter:0']],
      ['step:active', ['piece:active:0', 'piece:active:1']],
      ['step:exit', ['piece:exit:0']],
    ]);
    expect(g.edges.some((e) => e.from === 'piece:active:1' && e.to === 'channel:glow')).toBe(true);
    expect(g.nodes.some((n) => n.id === 'sign')).toBe(false);
  });

  it('leaves lengths off when staging failed', () => {
    const g = graphOf(fall, 'time', null);
    expect(g.nodes.find((n) => n.id === 'step:enter')?.lines).toEqual(['enter']);
  });

  it('says which view suits a pick', () => {
    expect(viewFor('piece:active:1', fall)).toBe('signal');
    expect(viewFor('channel:glow', fall)).toBe('signal');
    expect(viewFor('step:active', fall)).toBe('time');
    expect(viewFor('piece:enter:0', fall)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail.** `/Users/mike/src/bree/node_modules/.bin/vitest run --root /Users/mike/src/bree test/effect-graph.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `graph.ts`:**

```ts
import type { DataContainer, DataEdge, DataNode, DiagramData } from '@weasel-js/diagram';
import {
  type Channel,
  type EffectSpec,
  type Piece,
  piecesOf,
  SLOTS,
  type Slot,
  type Stretch,
  writesOf,
} from '@/index.js';

/** The three ways the diagram draws an effect. */
export type View = 'signal' | 'time' | 'both';
export const VIEWS: readonly View[] = ['signal', 'time', 'both'];

/** What a node of the diagram stands for. */
export type Part =
  | { kind: 'piece'; slot: Slot; index: number }
  | { kind: 'step'; slot: Slot }
  | { kind: 'channel'; channel: Channel }
  | { kind: 'sign' };

export function idOf(part: Part): string {
  switch (part.kind) {
    case 'piece':
      return `piece:${part.slot}:${part.index}`;
    case 'step':
      return `step:${part.slot}`;
    case 'channel':
      return `channel:${part.channel}`;
    case 'sign':
      return 'sign';
  }
}

const isSlot = (s: string | undefined): s is Slot => (SLOTS as readonly string[]).includes(s ?? '');

export function partOf(id: string): Part | null {
  if (id === 'sign') return { kind: 'sign' };
  const [head, a, b] = id.split(':');
  if (head === 'piece' && isSlot(a) && b !== undefined && /^\d+$/.test(b))
    return { kind: 'piece', slot: a, index: Number(b) };
  if (head === 'step' && isSlot(a) && b === undefined) return { kind: 'step', slot: a };
  if (head === 'channel' && a && b === undefined) return { kind: 'channel', channel: a as Channel };
  return null;
}

const nameOf = (p: Piece) => ('mod' in p ? p.mod : p.move);
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Every piece of the effect with its id, in slot order. */
function piecesIn(spec: EffectSpec) {
  return SLOTS.flatMap((slot) =>
    piecesOf(spec[slot]).map((piece, index) => ({
      id: idOf({ kind: 'piece', slot, index }),
      slot,
      piece,
    })),
  );
}

/** Each channel some piece writes, in the order first written. */
function channelsIn(spec: EffectSpec): Channel[] {
  return [...new Set(piecesIn(spec).flatMap(({ piece }) => writesOf(piece)))];
}

/** The effect as diagram data, in `view`; `parts` labels each step with its length. */
export function graphOf(
  spec: EffectSpec,
  view: View,
  parts: Readonly<Record<Slot, Stretch>> | null,
): DiagramData {
  const pieces = piecesIn(spec);
  const channels = channelsIn(spec);
  const nodes: DataNode[] = [];
  const edges: DataEdge[] = [];
  const join = (from: string, to: string, label?: string) =>
    edges.push({ id: `${from}>${to}`, from, to, ...(label && { label }) });
  const stepNode = (slot: Slot): DataNode => ({
    id: idOf({ kind: 'step', slot }),
    lines: parts ? [slot, seconds(parts[slot].ms)] : [slot],
  });
  const blend = `blend ${spec.blend ?? 0} ms`;
  const wires = () => {
    for (const { id, piece } of pieces)
      for (const c of writesOf(piece)) join(id, idOf({ kind: 'channel', channel: c }));
  };
  const channelNodes = () =>
    channels.map((c): DataNode => ({ id: idOf({ kind: 'channel', channel: c }), lines: [c] }));

  if (view === 'signal') {
    nodes.push(...pieces.map(({ id, slot, piece }) => ({ id, lines: [nameOf(piece), slot] })));
    nodes.push(...channelNodes(), { id: 'sign', lines: ['sign'] });
    wires();
    for (const c of channels) join(idOf({ kind: 'channel', channel: c }), 'sign');
    return { nodes, edges };
  }

  nodes.push(...SLOTS.map(stepNode));
  join('step:enter', 'step:active', blend);
  join('step:active', 'step:exit', blend);
  nodes.push(...pieces.map(({ id, piece }) => ({ id, lines: [nameOf(piece)] })));

  if (view === 'time') {
    for (const { id, slot } of pieces) join(idOf({ kind: 'step', slot }), id);
    return { nodes, edges };
  }

  // Both: the steps hold their pieces, so the step nodes give way to containers of the same ids.
  const containers: DataContainer[] = SLOTS.map((slot) => ({
    id: idOf({ kind: 'step', slot }),
    role: 'container',
    label: parts ? `${slot} · ${seconds(parts[slot].ms)}` : slot,
    members: pieces.filter((p) => p.slot === slot).map((p) => p.id),
  }));
  const stepIds = new Set(containers.map((c) => c.id));
  nodes.splice(0, nodes.length, ...nodes.filter((n) => !stepIds.has(n.id)), ...channelNodes());
  wires();
  return { nodes, edges, containers };
}

/** The view a picked id is best seen in, or null where any will do. */
export function viewFor(id: string, spec: EffectSpec): View | null {
  const part = partOf(id);
  if (!part) return null;
  if (part.kind === 'channel') return 'signal';
  if (part.kind === 'step') return 'time';
  if (part.kind === 'piece') {
    const piece = piecesOf(spec[part.slot])[part.index];
    return piece && 'mod' in piece ? 'signal' : null;
  }
  return null;
}
```

Before running, check `DataContainer` and `DiagramData` are exported from `@weasel-js/diagram`'s index (`grep -n "DataContainer" /Users/mike/src/weasel/packages/diagram/src/index.ts`); if `DataContainer` is not, import the type from where the index re-exports `dataTypes`. Check also that an edge between two containers is allowed: `DataEdge.from` names "a node's id, or a group's". If an edge to a container id is not drawn, drop the two `step → step` joins from the both view (the container order already reads left to right) and note it under Task 7.

- [ ] **Step 4: Run it and watch it pass.** Same command. Expected: PASS, all six.
- [ ] **Step 5: Commit** `graph.ts test/effect-graph.test.ts`: "draw an effect as diagram data in signal, time, and both views".

### Task 5: the picked id lives on the desk

**Files:** Modify `lab/compose/designer/open.ts`; Test `test/designer-desk.test.ts`

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, expect, it } from 'vitest';
import { designer } from '../lab/compose/designer/open.js';

describe("the designer's desk", () => {
  it('keeps a picked id, and drops it when another effect opens', () => {
    designer.setOpen('fall');
    designer.setPicked('piece:active:1');
    expect(designer.picked()).toBe('piece:active:1');
    designer.setOpen('scroll');
    expect(designer.picked()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail.** `…/vitest run --root /Users/mike/src/bree test/designer-desk.test.ts`. Expected: FAIL, `setPicked` is not a function.
- [ ] **Step 3: Implement.** In `open.ts`: add `picked: string | undefined;` to `Desk` (doc: `/** The diagram node, and so the card, picked: a graph id. */`), initialize `picked: undefined`, change `setOpen` to also clear it (`desk.picked = undefined;` before `notify()`), and add beside `text`:

```ts
  picked: () => desk.picked,
  setPicked(id: string | undefined) {
    if (desk.picked === id) return;
    desk.picked = id;
    notify();
  },
```

Also clear `desk.picked` in `undo` and `redo`, since an undone edit can remove the picked piece.
- [ ] **Step 4: Run it and watch it pass.** Expected: PASS.
- [ ] **Step 5: Commit** `open.ts test/designer-desk.test.ts`: "keep the picked diagram node on the designer's desk".

### Task 6: cards show and set the pick

**Files:** Modify `PieceCard.tsx`, `PieceCard.css`, `SlotBox.tsx`, `DesignerPanel.css`

- [ ] **Step 1: `PieceCard`** takes `picked: boolean` and `onPick: () => void`. Its root `div` gets a ref, `data-picked={picked || undefined}`, `onPointerDownCapture={onPick}`, and `onFocusCapture={onPick}` (with `// biome-ignore lint/a11y/noStaticElementInteractions: picking mirrors the card's own controls; focus covers the keyboard`). Scroll it into view when it becomes picked:

```tsx
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (picked) box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked]);
```

- [ ] **Step 2: `PieceCard.css`:**

```css
.compose-piece[data-picked] {
  outline: 2px solid var(--wzl-accent);
  outline-offset: 1px;
}
```

- [ ] **Step 3: `SlotBox`** reads the pick (`useDesk()`, `designer.picked()`), passes each card `picked={designer.picked() === idOf({ kind: 'piece', slot, index: i })}` and `onPick={() => designer.setPicked(idOf({ kind: 'piece', slot, index: i }))}`, and marks its `section` with `data-picked` when `designer.picked() === idOf({ kind: 'step', slot })`, scrolling it into view the same way.
- [ ] **Step 4: `DesignerPanel.css`:** `.compose-slot[data-picked] > .compose-heading { color: var(--wzl-accent); }`
- [ ] **Step 5: Lint** (subshell biome as in Task 3). **Commit** the four files: "mark the picked piece or step on the designer's cards, and pick from them".

### Task 7: the diagram panel

**Files:** Create `lab/compose/designer/EffectDiagram.tsx`, `EffectDiagram.css`; Modify `lab/effects/App.tsx`

- [ ] **Step 1: `EffectDiagram.tsx`:**

```tsx
import { DiagramView, diagramScene } from '@weasel-js/diagram';
import { registerCanvasFont } from '@weasel-js/font';
import { ToggleBar } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import { useLibrary } from '../library.js';
import { Panel } from '../Panel.js';
import { builtinOf } from './edit.js';
import { graphOf, partOf, type View, VIEWS, viewFor } from './graph.js';
import { designer, useDesk } from './open.js';
import { useStaged } from './staged.js';
import './EffectDiagram.css';

registerCanvasFont('sans-serif');
const FONT = { fontFamily: 'sans-serif', fontSize: 12 } as const;

const TIPS: Record<View, string> = {
  signal: 'Each piece wired to the channels it drives, and the channels to the sign.',
  time: 'Enter, active and exit in order, with how long each lasts and its pieces.',
  both: 'The steps in order holding their pieces, each wired to the channels it drives.',
};

/**
 * The open effect as a diagram, in the view the switch picks. Until the switch is touched, a pick
 * moves to the view that suits it. Mounted per open effect, so each starts in `both`.
 */
export function EffectDiagram() {
  useDesk();
  const shelf = useLibrary();
  const name = designer.open();
  const spec = name === undefined ? undefined : (shelf[name] ?? builtinOf(name));
  const staged = useStaged(spec, designer.text());
  const [view, setView] = useState<View>('both');
  const [chosen, setChosen] = useState(false);
  const data = useMemo(
    () => (spec ? graphOf(spec, view, staged?.parts ?? null) : null),
    [spec, view, staged],
  );
  const specs = useMemo(
    () => (data ? diagramScene(data, { font: FONT, layoutOptions: { direction: 'right' } }) : null),
    [data],
  );
  const picked = designer.picked() ?? null;
  return (
    <Panel
      title="diagram"
      className="effects-diagram"
      actions={
        <ToggleBar
          size="sm"
          ariaLabel="view"
          items={VIEWS.map((v) => ({ value: v, label: v, tooltip: TIPS[v] }))}
          value={view}
          onChange={(v) => {
            if (!v) return;
            setChosen(true);
            setView(v);
          }}
        />
      }
    >
      {specs && spec ? (
        <div className="effects-diagram-canvas">
          <DiagramView
            specs={specs}
            selected={data?.nodes.some((n) => n.id === picked) || data?.containers?.some((c) => c.id === picked) ? picked : null}
            onSelect={(id) => {
              const part = id ? partOf(id) : null;
              designer.setPicked(part && id ? id : undefined);
              const suits = id && !chosen ? viewFor(id, spec) : null;
              if (suits) setView(suits);
            }}
            anchor="start"
          />
        </div>
      ) : (
        <p className="compose-hint">Open an effect from the library to see it here.</p>
      )}
    </Panel>
  );
}
```

Check `ToggleBarItem` has a `tooltip` field (`sed -n 9,22p /Users/mike/src/weasel/packages/ui/src/components/ToggleBar/ToggleBar.tsx`); if it has none, drop `tooltip` and set the switch's `title` on a wrapping span instead (every setting carries an explanation on hover).

- [ ] **Step 2: `EffectDiagram.css`** (height capped so sign, playback and diagram fit an 800 px window together):

```css
.effects-diagram-canvas {
  position: relative;
  height: 320px;
  border-radius: var(--wzl-radius-sm, 4px);
  background: var(--wzl-surface-sunken);
  overflow: hidden;
}
```

- [ ] **Step 3: Place it.** In `lab/effects/App.tsx`, import `EffectDiagram` from `../compose/designer/EffectDiagram.js` and render `<EffectDiagram key={designerKey} />` between `<PreviewPlayback />` and `<DesignerPanel />`, where the key is the open effect's name so each effect mounts fresh: the `App` must call `useDesk()` and read `designer.open() ?? ''` for it.
- [ ] **Step 4: Lint** (subshell biome). Typecheck on the fleet (command at the top). Expected: no errors.
- [ ] **Step 5: Commit** the three files: "draw the open effect as a diagram on the effects page, picked in step with its cards".

### Task 8: check it in a browser, and shrink the spec

- [ ] **Step 1:** With the lab on :4885 (`npm --prefix /Users/mike/src/bree run dev` if it is not up), drive `http://localhost:4885/effects.html` headless (Playwright MCP). Open FALL from the library. Check: the diagram shows three containers and channel nodes in `both`; the switch redraws `signal` (pieces → channels → sign) and `time` (three steps, lengths, blend labels); clicking a card outlines it and selects its node (read `aria`/canvas selection, or screenshot); clicking a modulator node in `both` switches to `signal` until the switch is touched, then never again; no console errors. Find node positions with the view's `rectOf` if a click on the canvas is needed: expose nothing permanent for it; evaluate through React's devtools-free route of clicking the card instead where possible.
- [ ] **Step 2:** Screenshot each view, `transom post --zone bree <file>`, delete the files.
- [ ] **Step 3:** In the spec, mark step 1 built: under "What dragging changes", replace step 1's text with one line saying pick is built (2026-10-26) and where (`designer/graph.ts`, `EffectDiagram.tsx`), and change the status line to say steps 2–5 are not built. In `docs/compose.md`, add one sentence to the effects-page bullet: the open effect is also drawn as a diagram in signal, time and both views, picked in step with its cards.
- [ ] **Step 4: Commit** the two docs: "mark the effect diagram's pick step built".
- [ ] **Step 5:** Full suite on the fleet in the background: `onto test --about "bree suite after the effect diagram's pick step"`; read its exit code when it finishes.
