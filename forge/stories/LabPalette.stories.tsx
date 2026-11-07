import { PALETTE, Palette, type Swatch } from '@lab/paint/Palette.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import './stories.css';
import './lab-stories.css';

interface PaletteArgs {
  swatch: Swatch;
  custom: string;
}

/** The paint page's swatches and its well for a color of your own, picked from in place. */
function PaletteStory({ swatch: first, custom: own }: PaletteArgs) {
  const [swatch, setSwatch] = useState(first);
  const [custom, setCustom] = useState(own);
  return (
    <div className="forge-stack">
      <Palette swatch={swatch} custom={custom} onSwatch={setSwatch} onCustom={setCustom} />
      <output className="forge-value">{swatch === 'custom' ? custom : swatch}</output>
    </div>
  );
}

const meta: Meta<typeof PaletteStory> = {
  title: 'lab/paint/Palette',
  component: PaletteStory,
  args: { swatch: 'amber', custom: '#80ff80' },
  argTypes: {
    swatch: { control: 'select', options: [...Object.keys(PALETTE), 'custom'] },
    custom: { control: 'color' },
  },
};
export default meta;
type Story = StoryObj<typeof PaletteStory>;

export const Amber: Story = {};
export const Custom: Story = { args: { swatch: 'custom' } };
