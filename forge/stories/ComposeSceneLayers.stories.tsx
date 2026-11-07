import { SceneLayers } from '@lab/compose/panels/SceneLayers.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pane, withStore } from './ComposeStore.js';

const meta: Meta<typeof SceneLayers> = {
  title: 'lab/compose/SceneLayers',
  component: SceneLayers,
  decorators: withStore,
  render: () => (
    <Pane>
      <SceneLayers />
    </Pane>
  ),
};
export default meta;
type Story = StoryObj<typeof SceneLayers>;

export const Default: Story = {};
