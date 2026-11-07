import { builtinOf } from '@lab/compose/designer/edit.js';
import { useDesk } from '@lab/compose/designer/open.js';
import { WholeEffect } from '@lab/compose/designer/WholeEffect.js';
import { shelved, useLibrary } from '@lab/compose/library.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Bench, type BenchArgs, benchArgTypes } from './designer-bench.js';

/** The open effect's whole-effect settings, as the designer shows them. */
function OpenWhole() {
  const designer = useDesk();
  const shelf = useLibrary();
  const name = designer.open();
  const spec = name === undefined ? undefined : (shelved(shelf, name) ?? builtinOf(name));
  return name !== undefined && spec ? <WholeEffect name={name} spec={spec} /> : null;
}

/** An effect's name, its stagger over the sign, its hold and its blend. */
function Story(args: BenchArgs) {
  return (
    <Bench {...args}>
      <OpenWhole />
    </Bench>
  );
}

const meta: Meta<typeof Story> = {
  title: 'lab/designer/WholeEffect',
  component: Story,
  args: { open: 'my fall', text: 'HELLO' },
  argTypes: benchArgTypes,
};
export default meta;
type Obj = StoryObj<typeof Story>;

export const Saved: Obj = {};
export const BuiltIn: Obj = { args: { open: 'scroll' } };
