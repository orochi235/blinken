import { ScenePreview } from '@lab/compose/ScenePreview.js';
import { NO_EFFECTS } from '@lab/compose/Thumbnail.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useMemo } from 'react';
import { EFFECTS } from '@/index.js';
import './lab-stories.css';

interface ScenePreviewArgs {
  text: string;
  effect: string;
  color: string;
  live: boolean;
}

/** A scene as its row in the scene list shows it: a long message clips rather than shrinks. */
function ScenePreviewStory({ text, effect, color, live }: ScenePreviewArgs) {
  const scene = useMemo(
    () => ({ text: text || ' ', effect, hex: Number.parseInt(color.slice(1), 16) }),
    [text, effect, color],
  );
  return (
    <div className="lab-story-cell">
      <ScenePreview scene={scene} effects={NO_EFFECTS} live={live} />
    </div>
  );
}

const meta: Meta<typeof ScenePreviewStory> = {
  title: 'lab/compose/ScenePreview',
  component: ScenePreviewStory,
  args: { text: 'HELLO', effect: 'scroll', color: '#ffb020', live: false },
  argTypes: {
    effect: { control: 'select', options: Object.keys(EFFECTS) },
    color: { control: 'color' },
  },
};
export default meta;
type Story = StoryObj<typeof ScenePreviewStory>;

export const Held: Story = {};
export const Live: Story = { args: { live: true } };
export const LongMessage: Story = { args: { text: 'A MESSAGE TOO LONG FOR ITS ROW' } };
