import { ProgramPanel } from '@lab/compose/panels/ProgramPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pane, StorySign, withStore } from './ComposeStore.js';

const meta: Meta<typeof ProgramPanel> = {
  title: 'lab/compose/ProgramPanel',
  component: ProgramPanel,
  decorators: withStore,
};
export default meta;
type Story = StoryObj<typeof ProgramPanel>;

export const Default: Story = {
  render: () => (
    <Pane>
      <ProgramPanel />
    </Pane>
  ),
};
/** On a playing sign, the playing scene's row fills as it plays. */
export const Playing: Story = {
  render: () => (
    <>
      <StorySign />
      <Pane>
        <ProgramPanel />
      </Pane>
    </>
  ),
};
export const OneScene: Story = {
  parameters: {
    compose: {
      state: {
        effects: {},
        program: [{ effect: 'hold', text: 'ALONE', hex: 0xff9a2e }],
        editing: {},
      },
    },
  },
  render: () => (
    <Pane>
      <ProgramPanel />
    </Pane>
  ),
};
