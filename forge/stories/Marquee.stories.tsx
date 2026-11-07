import type { Meta, StoryObj } from '@weasel-js/forge';
import { useEffect, useRef } from 'react';
import { createMarquee, EFFECTS } from '@/index.js';
import './stories.css';

interface MarqueeArgs {
  text: string;
  effect: string;
  color: string;
  cols: number;
  rows: number;
}

/** A dot-matrix sign looping one effect on one message. */
function Marquee({ text, effect, color, cols, rows }: MarqueeArgs) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const hex = Number.parseInt(color.slice(1), 16);
    const sign = createMarquee(canvas.current, {
      cols,
      rows,
      program: [{ effect, text: text || ' ', hex }],
      color: hex,
    });
    return () => sign.destroy();
  }, [text, effect, color, cols, rows]);
  return <canvas ref={canvas} className="forge-canvas" />;
}

const meta: Meta<typeof Marquee> = {
  title: 'marquee/Marquee',
  component: Marquee,
  args: { text: 'HELLO', effect: 'scroll', color: '#ffb020', cols: 60, rows: 7 },
  argTypes: {
    effect: { control: 'select', options: Object.keys(EFFECTS) },
    color: { control: 'color' },
    cols: { control: { type: 'range', min: 20, max: 160, step: 1 } },
    rows: { control: { type: 'range', min: 7, max: 24, step: 1 } },
  },
};
export default meta;
type Story = StoryObj<typeof Marquee>;

export const Scroll: Story = {};
export const Flip: Story = { args: { effect: 'flip', text: 'FLIP' } };
