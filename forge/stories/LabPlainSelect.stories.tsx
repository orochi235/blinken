import { PlainSelect } from '@lab/compose/PlainSelect.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { EFFECTS } from '@/index.js';
import './stories.css';
import './lab-stories.css';

const OPTIONS = Object.keys(EFFECTS).map((name) => ({ value: name, label: name }));

interface PlainSelectArgs {
  label: string;
  disabled: boolean;
}

/** The lab's dropdown, its closed handle the value as underlined text. */
function PlainSelectStory({ label, disabled }: PlainSelectArgs) {
  const [picked, setPicked] = useState(OPTIONS[0]?.value ?? '');
  return (
    <div className="forge-stack">
      <PlainSelect
        aria-label={label}
        options={OPTIONS}
        selectedKey={picked}
        onSelectionChange={setPicked}
        isDisabled={disabled}
      />
      <output className="forge-value">{JSON.stringify(picked)}</output>
    </div>
  );
}

const meta: Meta<typeof PlainSelectStory> = {
  title: 'lab/compose/PlainSelect',
  component: PlainSelectStory,
  args: { label: 'effect', disabled: false },
};
export default meta;
type Story = StoryObj<typeof PlainSelectStory>;

export const Effects: Story = {};
export const Disabled: Story = { args: { disabled: true } };
