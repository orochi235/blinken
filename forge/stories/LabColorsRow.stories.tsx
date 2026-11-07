import { RENDERERS } from '@lab/compose/ColorsRow.js';
import { DENSITY, schemaFor } from '@lab/compose/schema.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ControlPanel, f } from '@weasel-js/labkit';
import { useState } from 'react';
import './stories.css';
import './lab-stories.css';

const START = [0xff3030, 0xffb020, 0x3ae8ff];

interface ColorsRowArgs {
  label: string;
}

/** A colors setting's row in a settings panel, with the list it holds beneath. */
function ColorsRowStory({ label }: ColorsRowArgs) {
  const [colors, setColors] = useState<unknown>(START);
  const schema = schemaFor(`story-colors:${label}`, () => ({
    colors: f
      .custom('colors', START)
      .label(label)
      .describe('The colors the effect cycles through.'),
  }));
  const set = (_: string, v: unknown) => setColors(v);
  return (
    <div className="forge-stack lab-story-wide">
      <ControlPanel
        density={DENSITY}
        schema={schema}
        config={{ colors }}
        setConfig={set}
        draftConfig={set}
        renderers={RENDERERS}
      />
      <output className="forge-value">
        {JSON.stringify((colors as number[]).map((c) => `#${c.toString(16).padStart(6, '0')}`))}
      </output>
    </div>
  );
}

const meta: Meta<typeof ColorsRowStory> = {
  title: 'lab/compose/ColorsRow',
  component: ColorsRowStory,
  args: { label: 'colors' },
};
export default meta;
type Story = StoryObj<typeof ColorsRowStory>;

export const Colors: Story = {};
