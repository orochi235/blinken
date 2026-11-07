import { ShareBar } from '@lab/compose/panels/ShareBar.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { withStore } from './ComposeStore.js';

const meta: Meta<typeof ShareBar> = {
  title: 'lab/compose/ShareBar',
  component: ShareBar,
  decorators: withStore,
};
export default meta;
type Story = StoryObj<typeof ShareBar>;

export const Default: Story = {};
/** Opened from a link that carried something the lab could not use. */
export const LeftOut: Story = {
  parameters: { compose: { dropped: ['scene 3: no effect named “sparkle”'] } },
};
/** Opened from a link that could not be read at all. */
export const Unreadable: Story = { parameters: { compose: { unreadable: true } } };
