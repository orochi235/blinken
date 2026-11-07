import { LibraryPanel } from '@lab/effects/LibraryPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** Every effect, the sample library's then the built-ins. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <LibraryPanel />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/effects/LibraryPanel',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Open: Obj = {};
export const NothingOpen: Obj = { args: { open: '' } };
