import { encode } from '@lab/compose/share.js';
import { definePlayer } from '@player/element.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { createElement } from 'react';
import { EFFECTS, GRIDS, type GridName, HOUSINGS, type Housing } from '@/index.js';

const TAG = 'blinken-player';
definePlayer(TAG);

type Bulbs = 'none' | 'unlit' | 'lit' | 'chase';

interface PlayerArgs {
  text: string;
  effect: string;
  color: string;
  cols: number;
  rows: number;
  grid: GridName;
  bulbs: Bulbs;
  housing: Housing;
}

/**
 * `<blinken-player>`, the custom element a page drops in to play a composition, given its program
 * as a share link and its hardware as attributes.
 */
function Player({ text, effect, color, cols, rows, grid, bulbs, housing }: PlayerArgs) {
  const program = encode({
    effects: {},
    program: [{ text: text || ' ', effect, hex: Number.parseInt(color.slice(1), 16) }],
    editing: {},
  });
  return createElement(TAG, {
    program,
    cols: String(cols),
    rows: String(rows),
    grid,
    bulbs,
    housing,
  });
}

const meta: Meta<typeof Player> = {
  title: 'player/Player',
  component: Player,
  args: {
    text: 'NOW PLAYING',
    effect: 'scroll',
    color: '#ffb020',
    cols: 80,
    rows: 7,
    grid: 'square',
    bulbs: 'unlit',
    housing: 'dark',
  },
  argTypes: {
    effect: { control: 'select', options: Object.keys(EFFECTS) },
    color: { control: 'color' },
    cols: { control: { type: 'range', min: 20, max: 160, step: 1 } },
    rows: { control: { type: 'range', min: 7, max: 24, step: 1 } },
    grid: { control: 'inline-radio', options: Object.keys(GRIDS) },
    bulbs: { control: 'inline-radio', options: ['none', 'unlit', 'lit', 'chase'] },
    housing: { control: 'inline-radio', options: [...HOUSINGS] },
  },
};
export default meta;
type Story = StoryObj<typeof Player>;

export const Default: Story = {};
export const Clear: Story = {
  args: { housing: 'clear', bulbs: 'none', effect: 'flip', text: 'CLEAR' },
};
