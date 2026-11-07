import { NO_EFFECTS, Thumbnail } from '@lab/compose/Thumbnail.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { EFFECTS, FACES, type FaceName } from '@/index.js';
import './lab-stories.css';

interface ThumbnailArgs {
  effect: string;
  text: string;
  face: FaceName;
  color: string;
  cols: number;
  rows: number;
  still: boolean;
  playing: boolean;
}

/** A small sign looping an effect, or held on the moment that best shows it. */
function ThumbnailStory({ effect, text, face, color, cols, rows, still, playing }: ThumbnailArgs) {
  return (
    <div className="lab-story-cell">
      <Thumbnail
        effect={effect}
        effects={NO_EFFECTS}
        text={text || ' '}
        face={face}
        hex={Number.parseInt(color.slice(1), 16)}
        cols={cols}
        rows={rows}
        still={still ? 'action' : undefined}
        playing={playing}
      />
    </div>
  );
}

const meta: Meta<typeof ThumbnailStory> = {
  title: 'lab/compose/Thumbnail',
  component: ThumbnailStory,
  args: {
    effect: 'scroll',
    text: 'HI',
    face: 'standard',
    color: '#ffb020',
    cols: 24,
    rows: 7,
    still: false,
    playing: false,
  },
  argTypes: {
    effect: { control: 'select', options: Object.keys(EFFECTS) },
    face: { control: 'select', options: Object.keys(FACES) },
    color: { control: 'color' },
    cols: { control: { type: 'range', min: 8, max: 60, step: 1 } },
    rows: { control: { type: 'range', min: 5, max: 16, step: 1 } },
  },
};
export default meta;
type Story = StoryObj<typeof ThumbnailStory>;

export const Looping: Story = {};
export const Still: Story = { args: { still: true, effect: 'flip' } };
