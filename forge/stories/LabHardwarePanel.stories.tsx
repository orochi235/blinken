import { HardwarePanel } from '@lab/compose/panels/HardwarePanel.js';
import { HARDWARE } from '@lab/compose/sign-hardware.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { StorySign, useSignPlayer } from './LabSign.stories.js';
import './stories.css';
import './lab-stories.css';

/** The hardware panel over a sign built from it, so each setting shows on the dots. */
function HardwarePanelStory() {
  const [hardware, setHardware] = useState(HARDWARE);
  const player = useSignPlayer();
  return (
    <div className="forge-stack lab-story-wide">
      <StorySign player={player} hardware={hardware} />
      <HardwarePanel hardware={hardware} setHardware={setHardware} />
    </div>
  );
}

const meta: Meta<typeof HardwarePanelStory> = {
  title: 'lab/compose/panels/HardwarePanel',
  component: HardwarePanelStory,
};
export default meta;
type Story = StoryObj<typeof HardwarePanelStory>;

export const Sign: Story = {};
