import { EffectDiagram } from '@lab/compose/designer/EffectDiagram.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** The open effect as a diagram. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <EffectDiagram />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/designer/EffectDiagram',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Open: Obj = {};
export const Modulated: Obj = { args: { open: 'neon bounce' } };
export const NothingOpen: Obj = { args: { open: '' } };
