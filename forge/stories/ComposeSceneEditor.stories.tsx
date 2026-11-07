import { SceneEditor } from '@lab/compose/panels/SceneEditor.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pane, withStore } from './ComposeStore.js';

const meta: Meta<typeof SceneEditor> = {
  title: 'lab/compose/SceneEditor',
  component: SceneEditor,
  decorators: withStore,
  render: () => (
    <Pane wide>
      <SceneEditor />
    </Pane>
  ),
};
export default meta;
type Story = StoryObj<typeof SceneEditor>;

export const Default: Story = {};
