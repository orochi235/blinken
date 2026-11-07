import type { Meta, StoryObj } from '@weasel-js/forge';
import { useEffect, useRef } from 'react';
import {
  createMarquee,
  EFFECTS,
  FACE_NAMES,
  type FaceName,
  GRIDS,
  type GridName,
  LAYERS,
} from '@/index.js';
import './stories.css';

type Bulbs = 'none' | 'unlit' | 'lit' | 'chase';

interface MarqueeArgs {
  text: string;
  effect: string;
  color: string;
  face: FaceName;
  grid: GridName;
  layer: string;
  bulbs: Bulbs;
  cols: number;
  rows: number;
}

/** A dot-matrix sign looping one effect on one message, in a face, on a grid, under a layer. */
function Marquee({ text, effect, color, face, grid, layer, bulbs, cols, rows }: MarqueeArgs) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const hex = Number.parseInt(color.slice(1), 16);
    const sign = createMarquee(canvas.current, {
      cols,
      rows,
      grid,
      program: [{ effect, text: text || ' ', hex, face }],
      layers: layer === 'none' ? {} : { [layer]: true },
      border: bulbs === 'none' ? false : { bulbs },
      color: hex,
    });
    return () => sign.destroy();
  }, [text, effect, color, face, grid, layer, bulbs, cols, rows]);
  return (
    <div className="forge-sign">
      <canvas ref={canvas} />
    </div>
  );
}

const meta: Meta<typeof Marquee> = {
  title: 'marquee/Marquee',
  component: Marquee,
  args: {
    text: 'HELLO',
    effect: 'scroll',
    color: '#ffb020',
    face: 'standard',
    grid: 'square',
    layer: 'none',
    bulbs: 'unlit',
    cols: 60,
    rows: 7,
  },
  argTypes: {
    effect: { control: 'select', options: Object.keys(EFFECTS) },
    color: { control: 'color' },
    face: { control: 'select', options: [...FACE_NAMES] },
    grid: { control: 'inline-radio', options: Object.keys(GRIDS) },
    layer: { control: 'select', options: ['none', ...Object.keys(LAYERS)] },
    bulbs: { control: 'inline-radio', options: ['none', 'unlit', 'lit', 'chase'] },
    cols: { control: { type: 'range', min: 20, max: 160, step: 1 } },
    rows: { control: { type: 'range', min: 7, max: 24, step: 1 } },
  },
};
export default meta;
type Story = StoryObj<typeof Marquee>;

export const Scroll: Story = {};
export const Flip: Story = { args: { effect: 'flip', text: 'FLIP' } };
export const Layered: Story = { args: { effect: 'hold', layer: 'rainbow', bulbs: 'chase' } };
export const Hex: Story = { args: { grid: 'hex', effect: 'hold', text: 'HEX' } };
