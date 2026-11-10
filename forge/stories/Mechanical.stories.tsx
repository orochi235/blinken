import type { Meta, StoryObj } from '@weasel-js/forge';
import { useEffect, useRef } from 'react';
import {
  createMechanical,
  type Mechanical as Handle,
  type MechanicalKind,
} from '@/mechanical/index.js';
import './stories.css';

interface MechanicalArgs {
  kind: MechanicalKind;
  cells: number;
  value: string;
  speed: number;
  stagger: number;
  /** The glyphs each cell turns through; empty for the kind's own. */
  glyphs: string;
  /** Sets a new value of random glyphs every second, to watch the turn. */
  spin: boolean;
}

/** Odometer reels or split-flap cards on a 2D canvas, turning forward to each new value. */
function Mechanical({ kind, cells, value, speed, stagger, glyphs, spin }: MechanicalArgs) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const made = useRef<Handle | null>(null);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (!canvas.current) return;
    const m = createMechanical(canvas.current, {
      kind,
      cells,
      speed,
      stagger,
      glyphs: glyphs || undefined,
      value: latest.current,
    });
    made.current = m;
    return () => {
      m.destroy();
      made.current = null;
    };
  }, [kind, cells, speed, stagger, glyphs]);
  useEffect(() => made.current?.set(value), [value]);
  useEffect(() => {
    if (!spin) return;
    const pick = [...(glyphs || (kind === 'reel' ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'))];
    const id = setInterval(() => {
      const next = Array.from(
        { length: cells },
        () => pick[Math.floor(Math.random() * pick.length)],
      );
      made.current?.set(next.join(''));
    }, 1000);
    return () => clearInterval(id);
  }, [spin, glyphs, kind, cells]);
  return <canvas ref={canvas} className="forge-canvas" />;
}

const meta: Meta<typeof Mechanical> = {
  title: 'mechanical/Mechanical',
  component: Mechanical,
  args: {
    kind: 'flap',
    cells: 8,
    value: 'GATE 12',
    speed: 14,
    stagger: 50,
    glyphs: '',
    spin: false,
  },
  argTypes: {
    kind: { control: 'inline-radio', options: ['flap', 'reel'] },
    cells: { control: { type: 'range', min: 1, max: 16, step: 1 } },
    speed: { control: { type: 'range', min: 2, max: 240, step: 1 } },
    stagger: { control: { type: 'range', min: 0, max: 200, step: 10 } },
  },
};
export default meta;
type Story = StoryObj<typeof Mechanical>;

export const Flap: Story = {};
export const Reel: Story = { args: { kind: 'reel', cells: 6, value: '042195', speed: 12 } };
/** A reel of letters and digits turning far and fast enough, about three glyphs a frame at 60 Hz, to blur. */
export const FastSpin: Story = {
  args: {
    kind: 'reel',
    cells: 4,
    value: 'A000',
    speed: 120,
    glyphs: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    spin: true,
  },
};
