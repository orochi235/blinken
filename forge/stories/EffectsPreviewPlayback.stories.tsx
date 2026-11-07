import { PreviewPanel, PreviewPlayback } from '@lab/effects/PreviewPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** The preview's playback controls, driving the preview sign above them. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <PreviewPanel />
      <PreviewPlayback />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/effects/PreviewPlayback',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Open: Obj = {};
