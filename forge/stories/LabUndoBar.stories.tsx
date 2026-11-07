import { type Undoable, UndoBar } from '@lab/shell/UndoBar.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, useSyncExternalStore } from 'react';
import './stories.css';
import './lab-stories.css';

/** A count with its own history: each change can be undone, and each undo redone. */
function counter(start: number) {
  let now = start;
  const past: number[] = [];
  let future: number[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  const history: Undoable & { get(): number; add(by: number): void } = {
    get: () => now,
    add(by) {
      past.push(now);
      future = [];
      now += by;
      notify();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undo() {
      const was = past.pop();
      if (was === undefined) return;
      future.push(now);
      now = was;
      notify();
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return;
      past.push(now);
      now = next;
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return history;
}

interface UndoBarArgs {
  start: number;
}

/** Undo and redo over a count the buttons beside them change; ⌘Z and ⇧⌘Z work too. */
function UndoBarStory({ start }: UndoBarArgs) {
  const [history] = useState(() => counter(start));
  const n = useSyncExternalStore(history.subscribe, history.get);
  return (
    <div className="lab-story-row">
      <UndoBar target={history} />
      <button type="button" onClick={() => history.add(-1)}>
        −1
      </button>
      <output className="forge-value">{n}</output>
      <button type="button" onClick={() => history.add(1)}>
        +1
      </button>
    </div>
  );
}

const meta: Meta<typeof UndoBarStory> = {
  title: 'lab/shell/UndoBar',
  component: UndoBarStory,
  args: { start: 0 },
};
export default meta;
type Story = StoryObj<typeof UndoBarStory>;

export const Count: Story = {};
