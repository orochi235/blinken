import { type Focus, Playback } from '@lab/compose/Playback.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { Pass, Slot, Stretch } from '@/index.js';
import { StorySign, useSignPlayer } from './LabSign.stories.js';
import './stories.css';
import './lab-stories.css';

const FOCI: readonly Focus[] = [
  { name: 'all', tip: 'Play the whole program round.' },
  { name: 'first', tip: 'Loop the first scene.' },
  { name: 'enter', tip: 'Loop how the first scene comes on.' },
  { name: 'active', tip: 'Loop the first scene while it stands.' },
  { name: 'exit', tip: 'Loop how the first scene goes.' },
];

function spanOf(pass: Pass, focus: string): Stretch | null {
  const scene = pass.scenes[0];
  if (focus === 'all' || !scene) return null;
  const span = focus === 'first' ? scene : scene.parts[focus as Slot];
  return span.ms > 0 ? span : null;
}

interface PlaybackArgs {
  rewindLabel: string;
}

/** Playback driving the sign above it: play and pause, a frame at a time, its rate, and a focus. */
function PlaybackStory({ rewindLabel }: PlaybackArgs) {
  const player = useSignPlayer();
  return (
    <div className="forge-stack lab-story-wide">
      <StorySign player={player} />
      <Playback player={player} foci={FOCI} spanOf={spanOf} rewindLabel={rewindLabel} />
    </div>
  );
}

const meta: Meta<typeof PlaybackStory> = {
  title: 'lab/compose/Playback',
  component: PlaybackStory,
  args: { rewindLabel: 'play again from the start' },
};
export default meta;
type Story = StoryObj<typeof PlaybackStory>;

export const Program: Story = {};
