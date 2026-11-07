import type { Meta, StoryObj } from '@weasel-js/forge';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { createOverlay, SELECTIONS, type Selection, TYPES, type TypeName } from '@/index.js';
import './stories.css';

const SPELLING = (Object.keys(TYPES) as TypeName[]).filter((t) => TYPES[t].spell && t !== 'half');

interface InputArgs {
  type: TypeName;
  cells: number;
  lines: number;
  wrap: boolean;
  selection: Selection;
  copy: 'shown' | 'value';
  color: string;
}

/** An editable readout, typed into like a text field; its value shows beneath it as typed. */
function Input({ type, cells, lines, wrap, selection, copy, color }: InputArgs) {
  const box = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('HELLO');
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (!box.current) return;
    const overlay = createOverlay();
    const readout = overlay.readout({
      type,
      cells,
      lines,
      wrap,
      selection,
      copy,
      edit: true,
      label: 'story input',
      value: latest.current,
      follow: box.current,
      color: Number.parseInt(color.slice(1), 16),
      onInput: setValue,
    });
    return () => {
      readout.destroy();
      overlay.destroy();
    };
  }, [type, cells, lines, wrap, selection, copy, color]);
  const { width, height } = TYPES[type].cell;
  const aspect = { '--aspect': String((width * cells) / (height * lines)) } as CSSProperties;
  return (
    <div className="forge-stack">
      <div ref={box} className="forge-box" style={aspect} />
      <output className="forge-value">{JSON.stringify(value)}</output>
    </div>
  );
}

const meta: Meta<typeof Input> = {
  title: 'readouts/Input',
  component: Input,
  args: {
    type: 'sixteen',
    cells: 8,
    lines: 1,
    wrap: true,
    selection: 'glow',
    copy: 'shown',
    color: '#ffb020',
  },
  argTypes: {
    type: { control: 'select', options: SPELLING },
    cells: { control: { type: 'range', min: 1, max: 16, step: 1 } },
    lines: { control: { type: 'range', min: 1, max: 4, step: 1 } },
    selection: { control: 'select', options: [...SELECTIONS] },
    copy: { control: 'inline-radio', options: ['shown', 'value'] },
    color: { control: 'color' },
  },
};
export default meta;
type Story = StoryObj<typeof Input>;

export const OneLine: Story = {};
export const Lines: Story = { args: { type: 'matrix', cells: 10, lines: 3, selection: 'block' } };
