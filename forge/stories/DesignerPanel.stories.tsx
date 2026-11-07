import { DesignerPanel } from '@lab/compose/designer/DesignerPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** The effect designer over a library of its own, with an effect open. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <DesignerPanel />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/designer/DesignerPanel',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Open: Obj = {};
export const BuiltIn: Obj = { args: { open: 'scroll' } };
export const NothingOpen: Obj = { args: { open: '' } };
