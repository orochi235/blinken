import { IconButton } from '@lab/compose/IconButton.js';
import { Panel } from '@lab/compose/Panel.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import './lab-stories.css';

interface PanelArgs {
  title: string;
  body: string;
  actions: boolean;
}

/** A lab pane: its title on the bar, with controls beside it when it has any. */
function PanelStory({ title, body, actions }: PanelArgs) {
  return (
    <div className="lab-story-wide">
      <Panel
        title={title}
        actions={actions && <IconButton glyph="add" label="add one" onClick={() => {}} />}
      >
        <p>{body}</p>
      </Panel>
    </div>
  );
}

const meta: Meta<typeof PanelStory> = {
  title: 'lab/compose/Panel',
  component: PanelStory,
  args: { title: 'scenes', body: 'What the pane holds goes here.', actions: false },
};
export default meta;
type Story = StoryObj<typeof PanelStory>;

export const Plain: Story = {};
export const WithActions: Story = { args: { actions: true } };
