import type { Meta, StoryObj } from '@weasel-js/forge';
import { useEffect, useRef } from 'react';
import { createPanel, TRANSITIONS, type TransitionName } from '@/index.js';
import './stories.css';

interface PanelArgs {
  face: 'plate' | 'none';
  transition: TransitionName;
  color: string;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/**
 * A panel: one canvas holding several readouts at places of its own choosing, here a clock, a
 * counter and a label, all drawn together.
 */
function Panel({ face, transition, color }: PanelArgs) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const hex = Number.parseInt(color.slice(1), 16);
    const panel = createPanel(canvas.current);
    const common = { face, color: hex, transition };
    const clock = panel.readout({
      ...common,
      type: 'seven',
      cells: 6,
      at: { x: 12, y: 12 },
      height: 48,
    });
    const count = panel.readout({
      ...common,
      type: 'nixie',
      cells: 4,
      at: { x: 12, y: 76 },
      height: 48,
    });
    const label = panel.readout({
      ...common,
      type: 'sixteen',
      cells: 8,
      at: { x: 12, y: 140 },
      height: 40,
    });
    const words = ['ARRIVALS', 'BOARDING', 'DELAYED', 'ON TIME'];
    let n = 0;
    const tick = () => {
      const now = new Date();
      clock.set(`${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`);
      count.set(pad(n % 10000, 4));
      label.set(words[Math.floor(n / 3) % words.length] ?? '');
      n++;
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      panel.destroy();
    };
  }, [face, transition, color]);
  return <canvas ref={canvas} className="forge-panel" />;
}

const meta: Meta<typeof Panel> = {
  title: 'readouts/Panel',
  component: Panel,
  args: { face: 'plate', transition: 'fade', color: '#ffb020' },
  argTypes: {
    face: { control: 'inline-radio', options: ['plate', 'none'] },
    transition: { control: 'select', options: Object.keys(TRANSITIONS) },
    color: { control: 'color' },
  },
};
export default meta;
type Story = StoryObj<typeof Panel>;

export const Default: Story = {};
export const Flap: Story = { args: { transition: 'flap', color: '#4fd8ff' } };
