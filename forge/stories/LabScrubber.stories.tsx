import { type SceneLook, Scrubber } from '@lab/compose/Scrubber.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { PROGRAM, StorySign, useSignPlayer } from './LabSign.stories.js';
import './stories.css';
import './lab-stories.css';

const look: SceneLook = (s) => PROGRAM[s.scene];

interface ScrubberArgs {
  phases: boolean;
}

/** The scrubber under the sign it drives: press or drag to hold a moment, let go to play on. */
function ScrubberStory({ phases }: ScrubberArgs) {
  const player = useSignPlayer();
  return (
    <div className="forge-stack lab-story-wide">
      <StorySign player={player} />
      <Scrubber player={player} look={look} phases={phases} />
    </div>
  );
}

const meta: Meta<typeof ScrubberStory> = {
  title: 'lab/compose/Scrubber',
  component: ScrubberStory,
  args: { phases: false },
};
export default meta;
type Story = StoryObj<typeof ScrubberStory>;

export const Pass: Story = {};
export const Phases: Story = { args: { phases: true } };
