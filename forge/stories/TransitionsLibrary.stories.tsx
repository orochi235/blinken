import { TransitionsProvider, useTransitions } from '@lab/transitions/context.js';
import { Library } from '@lab/transitions/Library.js';
import { createTransitionsStore } from '@lab/transitions/store.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { LabRoot } from '@weasel-js/labkit';
import { useMemo } from 'react';
import type { TransitionRecipe } from '@/index.js';
import './paint-stories.css';
import './stories.css';

const SAVED: TransitionRecipe[] = [
  { name: 'departures', ms: 1200, move: 'step', order: 'left', spread: 0.4 },
  { name: 'static', ms: 600, move: 'scramble', order: 'random', spread: 0.8, rolls: 14 },
];

interface LibraryArgs {
  saved: boolean;
}

function Listed() {
  const { open } = useTransitions();
  return (
    <div className="forge-stack">
      <div className="story-library">
        <Library />
      </div>
      <output className="forge-value">{`open: ${open}`}</output>
    </div>
  );
}

/** The transitions page's list of built-in and saved transitions, on a store of its own. */
function LibraryStory({ saved }: LibraryArgs) {
  const store = useMemo(
    () =>
      createTransitionsStore({
        seed: saved ? { saved: SAVED, open: 'static' } : { saved: [], open: 'flap' },
      }),
    [saved],
  );
  return (
    <LabRoot mode="dark" className="story-lab">
      <TransitionsProvider value={store}>
        <Listed />
      </TransitionsProvider>
    </LabRoot>
  );
}

const meta: Meta<typeof LibraryStory> = {
  title: 'lab/transitions/Library',
  component: LibraryStory,
  args: { saved: true },
};
export default meta;
type Story = StoryObj<typeof LibraryStory>;

export const WithSaved: Story = {};
export const BuiltInsOnly: Story = { args: { saved: false } };
