import { TransitionsProvider, useTransitions } from '@lab/transitions/context.js';
import { Editor } from '@lab/transitions/Editor.js';
import { BUILT_INS, createTransitionsStore, recipeNamed } from '@lab/transitions/store.js';
import { LabRoot } from '@weasel-js/labkit';
import './paint-stories.css';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useMemo } from 'react';
import type { TransitionRecipe } from '@/index.js';

const SAVED: TransitionRecipe[] = [
  {
    name: 'departures',
    ms: 1200,
    move: 'step',
    order: 'left',
    spread: 0.4,
    through: ' ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  },
  { name: 'static', ms: 600, move: 'scramble', order: 'random', spread: 0.8, rolls: 14 },
];

interface EditorArgs {
  open: string;
}

function Open() {
  const { open, saved } = useTransitions();
  return <Editor recipe={recipeNamed(open, saved)} />;
}

/** The transitions page's settings for the open transition, on a store of its own holding two saved ones. */
function EditorStory({ open }: EditorArgs) {
  const store = useMemo(() => createTransitionsStore({ seed: { saved: SAVED, open } }), [open]);
  return (
    <LabRoot mode="dark" className="story-lab">
      <TransitionsProvider value={store}>
        <div className="story-editor">
          <Open />
        </div>
      </TransitionsProvider>
    </LabRoot>
  );
}

const meta: Meta<typeof EditorStory> = {
  title: 'lab/transitions/Editor',
  component: EditorStory,
  args: { open: 'departures' },
  argTypes: {
    open: { control: 'select', options: [...SAVED.map((r) => r.name), ...BUILT_INS] },
  },
};
export default meta;
type Story = StoryObj<typeof EditorStory>;

export const Saved: Story = {};
export const BuiltIn: Story = { args: { open: 'flap' } };
