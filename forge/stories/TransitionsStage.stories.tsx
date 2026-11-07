import { Stage } from '@lab/transitions/Stage.js';
import { STAGE_TYPES } from '@lab/transitions/store.js';
import './paint-stories.css';
import { IconRegistryProvider } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { LabRoot } from '@weasel-js/labkit';
import { kitIcons } from '@weasel-js/ui/kit-icons';
import { TRANSITIONS, type TransitionName, type TypeName } from '@/index.js';

interface StageArgs {
  transition: TransitionName;
  type: TypeName;
  cells: number;
  from: string;
  to: string;
  color: string;
}

/** The transitions page's stage: a built-in played over and over, above its filmstrip. */
function StageStory({ transition, ...stage }: StageArgs) {
  return (
    <IconRegistryProvider icons={kitIcons}>
      <LabRoot mode="dark" className="story-lab">
        <Stage recipe={TRANSITIONS[transition].recipe} stage={stage} />
      </LabRoot>
    </IconRegistryProvider>
  );
}

const meta: Meta<typeof StageStory> = {
  title: 'lab/transitions/Stage',
  component: StageStory,
  args: {
    transition: 'flap',
    type: 'sixteen',
    cells: 8,
    from: 'ARRIVALS',
    to: 'DELAYED',
    color: '#4fd8ff',
  },
  argTypes: {
    transition: { control: 'select', options: Object.keys(TRANSITIONS) },
    type: { control: 'select', options: STAGE_TYPES },
    cells: { control: { type: 'range', min: 1, max: 24, step: 1 } },
    color: { control: 'color' },
  },
};
export default meta;
type Story = StoryObj<typeof StageStory>;

export const Flap: Story = {};
export const Matrix: Story = {
  args: { type: 'matrix', cells: 6, from: '1999', to: '2026', color: '#ffb020' },
};
