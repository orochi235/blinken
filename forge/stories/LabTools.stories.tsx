import type { Shape, Tool } from '@lab/paint/model.js';
import { Tools } from '@lab/paint/Tools.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import '@lab/paint/App.css';
import './stories.css';

const TOOLS: readonly Tool[] = ['paint', 'shade', 'erase', 'fill', 'text'];

interface ToolsArgs {
  tool: Tool;
}

/** The paint page's tool row, picked from in place; fill and text leave the shapes off. */
function ToolsStory({ tool: first }: ToolsArgs) {
  const [tool, setTool] = useState(first);
  const [shape, setShape] = useState<Shape>('round');
  const [size, setSize] = useState(3);
  const [level, setLevel] = useState(1);
  return (
    <div className="forge-stack">
      <Tools
        tool={tool}
        shape={shape}
        size={size}
        level={level}
        onTool={setTool}
        onShape={setShape}
        onSize={setSize}
        onLevel={setLevel}
      />
      <output className="forge-value">{JSON.stringify({ tool, shape, size, level })}</output>
    </div>
  );
}

const meta: Meta<typeof ToolsStory> = {
  title: 'lab/paint/Tools',
  component: ToolsStory,
  args: { tool: 'paint' },
  argTypes: {
    tool: { control: 'inline-radio', options: [...TOOLS] },
  },
};
export default meta;
type Story = StoryObj<typeof ToolsStory>;

export const Paint: Story = {};
export const Fill: Story = { args: { tool: 'fill' } };
