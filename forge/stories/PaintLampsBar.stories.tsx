import { PaintProvider, usePaint } from '@lab/paint/context.js';
import { LampsBar } from '@lab/paint/LampsBar.js';
import { createPaintStore } from '@lab/paint/store.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { LabRoot } from '@weasel-js/labkit';
import { useMemo } from 'react';
import '@lab/paint/App.css';
import './paint-stories.css';
import './stories.css';

interface LampsArgs {
  size: number;
  gap: number;
  fit: boolean;
}

function Bar() {
  const { lamps } = usePaint();
  return (
    <div className="forge-stack">
      <LampsBar lamps={lamps} />
      <output className="forge-value">{JSON.stringify(lamps, null, 1)}</output>
    </div>
  );
}

/** The paint page's lamp sliders, on a store of its own seeded with `size`, `gap` and `fit`. */
function LampsBarStory({ size, gap, fit }: LampsArgs) {
  const store = useMemo(
    () => createPaintStore({ seed: { lamps: { size, gap, fit, brightness: 1, glow: 1 } } }),
    [size, gap, fit],
  );
  return (
    <LabRoot mode="dark" className="story-lab">
      <PaintProvider value={store}>
        <Bar />
      </PaintProvider>
    </LabRoot>
  );
}

const meta: Meta<typeof LampsBarStory> = {
  title: 'lab/paint/LampsBar',
  component: LampsBarStory,
  args: { size: 14, gap: 5, fit: true },
  argTypes: {
    size: { control: { type: 'range', min: 2, max: 40, step: 1 } },
    gap: { control: { type: 'range', min: 0, max: 30, step: 1 } },
  },
};
export default meta;
type Story = StoryObj<typeof LampsBarStory>;

export const Fitted: Story = {};
export const Fixed: Story = { args: { size: 24, gap: 2, fit: false } };
