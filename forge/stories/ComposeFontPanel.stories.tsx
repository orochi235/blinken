import { FontPanel } from '@lab/compose/panels/FontPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pane, withStore } from './ComposeStore.js';

const meta: Meta<typeof FontPanel> = {
  title: 'lab/compose/FontPanel',
  component: FontPanel,
  decorators: withStore,
  args: { setRows: () => {} },
  render: (args) => (
    <Pane>
      <FontPanel {...args} />
    </Pane>
  ),
};
export default meta;
type Story = StoryObj<typeof FontPanel>;

export const Default: Story = {};
/** Letters taller than the sign: the panel offers the height that shows them all. */
export const RunsOff: Story = {
  parameters: {
    compose: {
      state: {
        effects: {},
        program: [{ effect: 'hold', text: 'TALL', hex: 0xff9a2e, face: 'jersey-10' }],
        editing: { scene: 0 },
      },
    },
  },
};
