import { RENDERERS } from '@lab/compose/ColorsRow.js';
import { DENSITY, schemaFor } from '@lab/compose/schema.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ControlPanel, f } from '@weasel-js/labkit';
import { useState } from 'react';
import './stories.css';
import './lab-stories.css';

interface LinesRowArgs {
  label: string;
  start: string;
}

/** A message's row: Enter takes a new line, and the box grows with its lines up to four. */
function LinesRowStory({ label, start }: LinesRowArgs) {
  const [text, setText] = useState<unknown>(start);
  const schema = schemaFor(`story-lines:${label}`, () => ({
    text: f.custom('lines', '').label(label).describe('What the scene says.'),
  }));
  const set = (_: string, v: unknown) => setText(v);
  return (
    <div className="forge-stack lab-story-wide">
      <ControlPanel
        density={DENSITY}
        schema={schema}
        config={{ text }}
        setConfig={set}
        draftConfig={set}
        renderers={RENDERERS}
      />
      <output className="forge-value">{JSON.stringify(text)}</output>
    </div>
  );
}

const meta: Meta<typeof LinesRowStory> = {
  title: 'lab/compose/LinesRow',
  component: LinesRowStory,
  args: { label: 'text', start: 'HELLO' },
};
export default meta;
type Story = StoryObj<typeof LinesRowStory>;

export const OneLine: Story = {};
export const ThreeLines: Story = { args: { start: 'ONE\nTWO\nTHREE' } };
