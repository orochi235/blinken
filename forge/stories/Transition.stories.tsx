import type { Meta, StoryObj } from '@weasel-js/forge';
import { type CSSProperties, useEffect, useRef } from 'react';
import {
  createOverlay,
  createTransition,
  type TransitionEasing,
  type TransitionMove,
  type TransitionOrder,
  TYPES,
} from '@/index.js';
import './stories.css';

interface TransitionArgs {
  move: TransitionMove;
  order: TransitionOrder;
  spread: number;
  easing: TransitionEasing;
  ms: number;
  from: string;
  to: string;
}

/** A transition made by `createTransition`, played back and forth between two values. */
function Transition({ move, order, spread, easing, ms, from, to }: TransitionArgs) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const overlay = createOverlay({ fade: { rise: 10, fall: 20 } });
    const readout = overlay.readout({
      type: 'sixteen',
      cells: 8,
      follow: box.current,
      select: false,
      color: 0x4fd8ff,
      transition: createTransition({ name: 'story', move, order, spread, easing, ms }),
    });
    let n = 0;
    readout.set(from);
    const timer = setInterval(() => readout.set(++n % 2 ? to : from), ms + 1000);
    return () => {
      clearInterval(timer);
      overlay.destroy();
    };
  }, [move, order, spread, easing, ms, from, to]);
  const { width, height } = TYPES.sixteen.cell;
  const aspect = { '--aspect': String((width * 8) / height) } as CSSProperties;
  return <div ref={box} className="forge-box" style={aspect} />;
}

const meta: Meta<typeof Transition> = {
  title: 'readouts/Transition',
  component: Transition,
  args: {
    move: 'step',
    order: 'left',
    spread: 0.3,
    easing: 'linear',
    ms: 1400,
    from: 'ARRIVALS',
    to: 'DELAYED',
  },
  argTypes: {
    move: { control: 'select', options: ['cut', 'fade', 'step', 'scramble', 'count'] },
    order: { control: 'select', options: ['left', 'right', 'center', 'edges', 'random'] },
    spread: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    easing: { control: 'select', options: ['linear', 'in', 'out', 'in-out'] },
    ms: { control: { type: 'range', min: 100, max: 3000, step: 50 } },
  },
};
export default meta;
type Story = StoryObj<typeof Transition>;

export const Flap: Story = {};
export const Scramble: Story = { args: { move: 'scramble', spread: 0.6, ms: 700 } };
export const Count: Story = {
  args: { move: 'count', easing: 'out', ms: 800, from: '1999', to: '2026' },
};
