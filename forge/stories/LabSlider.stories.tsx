import { Slider } from '@lab/paint/Slider.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import '@lab/paint/App.css';

interface SliderArgs {
  label: string;
  title: string;
  min: number;
  max: number;
  step: number;
  digits: number;
}

/** A labeled range with its value read out after it. */
function SliderStory({ label, title, min, max, step, digits }: SliderArgs) {
  const [value, setValue] = useState(min);
  return (
    <Slider
      label={label}
      title={title}
      min={min}
      max={max}
      step={step}
      digits={digits}
      value={Math.min(max, Math.max(min, value))}
      onChange={setValue}
    />
  );
}

const meta: Meta<typeof SliderStory> = {
  title: 'lab/paint/Slider',
  component: SliderStory,
  args: { label: 'size', title: 'How many dots across.', min: 1, max: 15, step: 1, digits: 0 },
  argTypes: {
    digits: { control: { type: 'range', min: 0, max: 3, step: 1 } },
  },
};
export default meta;
type Story = StoryObj<typeof SliderStory>;

export const Whole: Story = {};
export const Fraction: Story = {
  args: { label: 'level', title: 'How brightly.', min: 0.05, max: 1, step: 0.05, digits: 2 },
};
