import { GalleryPanel } from '@lab/compose/panels/GalleryPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pane, withStore } from './ComposeStore.js';

const meta: Meta<typeof GalleryPanel> = {
  title: 'lab/compose/GalleryPanel',
  component: GalleryPanel,
  decorators: withStore,
  render: () => (
    <Pane wide>
      <GalleryPanel />
    </Pane>
  ),
};
export default meta;
type Story = StoryObj<typeof GalleryPanel>;

export const Default: Story = {};
