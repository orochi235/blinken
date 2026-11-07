import { builtinOf } from '@lab/compose/designer/edit.js';
import { useDesk } from '@lab/compose/designer/open.js';
import { SlotBox } from '@lab/compose/designer/SlotBox.js';
import { useStaged } from '@lab/compose/designer/staged.js';
import { shelved, useLibrary } from '@lab/compose/library.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SLOTS, type Slot } from '@/index.js';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** `slot` of the open effect, with what staging it warned, as the designer shows it. */
function OpenSlot({ slot }: { slot: Slot }) {
  const designer = useDesk();
  const shelf = useLibrary();
  const name = designer.open();
  const spec = name === undefined ? undefined : (shelved(shelf, name) ?? builtinOf(name));
  const warnings = useStaged(spec, designer.text())?.warnings.get(slot) ?? [];
  return spec ? <SlotBox slot={slot} spec={spec} warnings={warnings} /> : null;
}

/** One slot of the open effect: its pieces, and a way to add one. */
function Story({ slot, ...args }: BenchArgs & { slot: Slot }) {
  return (
    <Bench {...args}>
      <OpenSlot slot={slot} />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/designer/SlotBox',
  component: Story,
  args: { open: 'my fall', text: 'HELLO', slot: 'enter' },
  argTypes: { ...benchArgTypes, slot: { control: 'inline-radio', options: [...SLOTS] } },
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Enter: Obj = {};
export const Active: Obj = { args: { open: 'neon bounce', slot: 'active' } };
export const Exit: Obj = { args: { slot: 'exit' } };
