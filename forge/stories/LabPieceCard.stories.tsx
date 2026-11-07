import { pieceOf } from '@lab/compose/designer/edit.js';
import { PieceCard } from '@lab/compose/designer/PieceCard.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { type Piece, SLOTS, type Slot } from '@/index.js';
import './stories.css';
import './lab-stories.css';

interface PieceCardArgs {
  slot: Slot;
  start: string;
}

/** One piece of an effect's slot, edited in place; the piece it now is shows beneath. */
function PieceCardStory({ slot, start }: PieceCardArgs) {
  const [piece, setPiece] = useState<Piece | null>(() => pieceOf(start));
  const [picked, setPicked] = useState(false);
  return (
    <div className="forge-stack lab-story-wide">
      {piece ? (
        <PieceCard
          slot={slot}
          piece={piece}
          onEdit={(fn) => setPiece((now) => now && fn(now))}
          onRemove={() => setPiece(null)}
          picked={picked}
          onPick={() => setPicked(true)}
        />
      ) : (
        <button type="button" onClick={() => setPiece(pieceOf(start))}>
          put it back
        </button>
      )}
      <output className="forge-value">{JSON.stringify(piece, null, 2)}</output>
    </div>
  );
}

const meta: Meta<typeof PieceCardStory> = {
  title: 'lab/compose/designer/PieceCard',
  component: PieceCardStory,
  args: { slot: 'enter', start: 'drop-in' },
  argTypes: {
    slot: { control: 'inline-radio', options: [...SLOTS] },
  },
};
export default meta;
type Story = StoryObj<typeof PieceCardStory>;

export const Move: Story = {};
export const Modulator: Story = { args: { slot: 'active', start: 'mod:gradient' } };
