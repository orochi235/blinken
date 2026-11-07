import { LibraryBar } from '@lab/effects/LibraryBar.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** The effects page's bar: undo, export and load. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <LibraryBar />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/effects/LibraryBar',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Default: Obj = {};
