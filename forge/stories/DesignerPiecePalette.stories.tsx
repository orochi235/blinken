import { PiecePalette } from '@lab/compose/designer/PiecePalette.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';
import './designer-stories.css';

/** Every move and modulator, to drag onto the effect diagram or click to add. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <div className="designer-story-palette">
        <PiecePalette />
      </div>
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/designer/PiecePalette',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Open: Obj = {};
export const NothingOpen: Obj = { args: { open: '' } };
