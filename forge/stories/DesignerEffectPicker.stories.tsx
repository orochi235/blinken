import { EffectPicker } from '@lab/compose/designer/EffectPicker.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** The picker that opens an effect in the designer. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <EffectPicker />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/designer/EffectPicker',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Open: Obj = {};
export const NothingOpen: Obj = { args: { open: '' } };
