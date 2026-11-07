import { FileButtons } from '@lab/compose/panels/FileButtons.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { withStore } from './ComposeStore.js';

const meta: Meta<typeof FileButtons> = {
  title: 'lab/compose/FileButtons',
  component: FileButtons,
  decorators: withStore,
};
export default meta;
type Story = StoryObj<typeof FileButtons>;

export const Default: Story = {};
