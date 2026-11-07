import { PlaybackPanel } from '@lab/compose/panels/PlaybackPanel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Pane, StorySign, withStore } from './ComposeStore.js';

const meta: Meta<typeof PlaybackPanel> = {
  title: 'lab/compose/PlaybackPanel',
  component: PlaybackPanel,
  decorators: withStore,
};
export default meta;
type Story = StoryObj<typeof PlaybackPanel>;

/** Driving a sign of its own. */
export const Default: Story = {
  render: () => (
    <>
      <StorySign />
      <Pane>
        <PlaybackPanel />
      </Pane>
    </>
  ),
};
/** With no sign, as before the page draws one. */
export const NoSign: Story = {
  render: () => (
    <Pane>
      <PlaybackPanel />
    </Pane>
  ),
};
