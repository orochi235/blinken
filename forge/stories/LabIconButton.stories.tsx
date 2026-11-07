import { GLYPHS, IconButton } from '@lab/compose/IconButton.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import './lab-stories.css';

type Glyph = keyof typeof GLYPHS;

interface IconButtonArgs {
  glyph: Glyph;
  label: string;
  disabled: boolean;
  toggle: boolean;
}

/** One icon button; as a toggle, a click presses it and the next lets it up. */
function IconButtonStory({ glyph, label, disabled, toggle }: IconButtonArgs) {
  const [pressed, setPressed] = useState(false);
  return (
    <IconButton
      glyph={glyph}
      label={label}
      disabled={disabled}
      pressed={toggle ? pressed : undefined}
      onClick={() => setPressed((p) => !p)}
    />
  );
}

/** Every glyph the lab's icon buttons draw. */
function Glyphs() {
  return (
    <div className="lab-story-row">
      {(Object.keys(GLYPHS) as Glyph[]).map((g) => (
        <IconButton key={g} glyph={g} label={g} onClick={() => {}} />
      ))}
    </div>
  );
}

const meta: Meta<typeof IconButtonStory> = {
  title: 'lab/compose/IconButton',
  component: IconButtonStory,
  args: { glyph: 'add', label: 'add a scene', disabled: false, toggle: false },
  argTypes: {
    glyph: { control: 'select', options: Object.keys(GLYPHS) },
  },
};
export default meta;
type Story = StoryObj<typeof IconButtonStory>;

export const Button: Story = {};
export const Toggle: Story = { args: { glyph: 'loop', label: 'loop', toggle: true } };
export const Disabled: Story = { args: { glyph: 'undo', label: 'undo', disabled: true } };
export const AllGlyphs: Story = { render: () => <Glyphs /> };
