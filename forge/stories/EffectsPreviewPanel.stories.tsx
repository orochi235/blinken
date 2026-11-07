import { PreviewPanel } from '@lab/effects/PreviewPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** The open effect looping on the preview sign. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <PreviewPanel />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/effects/PreviewPanel',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Open: Obj = {};
export const NothingOpen: Obj = { args: { open: '' } };
