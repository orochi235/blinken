import { SceneTuning } from '@lab/compose/panels/SceneTuning.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pane, withStore } from './ComposeStore.js';

const meta: Meta<typeof SceneTuning> = {
  title: 'lab/compose/SceneTuning',
  component: SceneTuning,
  decorators: withStore,
  render: () => (
    <Pane>
      <SceneTuning />
    </Pane>
  ),
};
export default meta;
type Story = StoryObj<typeof SceneTuning>;

export const Default: Story = {};
