import type { Meta, StoryObj } from '@weasel-js/forge';
import { type CSSProperties, useEffect, useRef } from 'react';
import {
  createOverlay,
  type Readout as Handle,
  TRANSITIONS,
  type TransitionName,
  TYPES,
  type TypeName,
} from '@/index.js';
import './stories.css';

interface ReadoutArgs {
  type: TypeName;
  cells: number;
  value: string;
  color: string;
  face: 'plate' | 'none';
  transition: TransitionName;
}

/** One segment readout, drawn by an overlay over the box it follows. */
function Readout({ type, cells, value, color, face, transition }: ReadoutArgs) {
  const box = useRef<HTMLDivElement>(null);
  const readout = useRef<Handle | null>(null);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (!box.current) return;
    const overlay = createOverlay();
    readout.current = overlay.readout({
      type,
      cells,
      face,
      follow: box.current,
      color: Number.parseInt(color.slice(1), 16),
    });
    readout.current.set(latest.current);
    return () => {
      overlay.destroy();
      readout.current = null;
    };
  }, [type, cells, face, color]);
  useEffect(() => readout.current?.setTransition(transition), [transition]);
  useEffect(() => readout.current?.set(value), [value]);
  const { width, height } = TYPES[type].cell;
  const aspect = { '--aspect': String((width * cells) / height) } as CSSProperties;
  return <div ref={box} className="forge-box" style={aspect} />;
}

const meta: Meta<typeof Readout> = {
  title: 'readouts/Readout',
  component: Readout,
  args: {
    type: 'sixteen',
    cells: 8,
    value: 'BLINKEN',
    color: '#ffb020',
    face: 'plate',
    transition: 'flap',
  },
  argTypes: {
    type: { control: 'select', options: Object.keys(TYPES) },
    cells: { control: { type: 'range', min: 1, max: 16, step: 1 } },
    color: { control: 'color' },
    face: { control: 'inline-radio', options: ['plate', 'none'] },
    transition: { control: 'select', options: Object.keys(TRANSITIONS) },
  },
};
export default meta;
type Story = StoryObj<typeof Readout>;

export const Sixteen: Story = {};
export const Seven: Story = {
  args: { type: 'seven', cells: 6, value: '123456', transition: 'count' },
};
export const Nixie: Story = {
  args: { type: 'nixie', cells: 6, value: '220114', color: '#ff7a1e', transition: 'roll' },
};
