import { Select } from '@weasel-js/labkit';
import { type EffectSpec, piecesOf, type Slot } from '@/index.js';
import { addPiece, removePiece, setPiece } from '../state.js';
import { editEffect, pieceOf, pieceOptions } from './edit.js';
import { PieceCard } from './PieceCard.js';

/** One slot of the open effect: its pieces, a way to add one, and what staging it warned. */
export function SlotBox({
  spec,
  slot,
  warnings,
}: {
  spec: EffectSpec;
  slot: Slot;
  warnings: readonly string[];
}) {
  return (
    <section className={`compose-slot compose-slot-${slot}`} aria-label={slot}>
      <h3 className="compose-heading">{slot}</h3>
      {piecesOf(spec[slot]).map((piece, i) => (
        <PieceCard
          // biome-ignore lint/suspicious/noArrayIndexKey: a piece is its place in the slot
          key={`${i}:${'mod' in piece ? piece.mod : piece.move}`}
          slot={slot}
          piece={piece}
          // Every write reads the slot as it stands now, not the `spec` this card drew from.
          onEdit={(fn) =>
            editEffect((e) => {
              const now = piecesOf(e[slot])[i];
              return now ? setPiece(e, slot, i, fn(now)) : e;
            })
          }
          onRemove={() => editEffect((e) => removePiece(e, slot, i))}
        />
      ))}
      <Select
        aria-label={`add a piece to ${slot}`}
        placeholder="add a piece…"
        options={pieceOptions(slot)}
        selectedKey={null}
        onSelectionChange={(key) => {
          if (key) editEffect((e) => addPiece(e, slot, pieceOf(key)));
        }}
      />
      {warnings.map((w) => (
        <p key={w} className="compose-warning">
          {w}
        </p>
      ))}
    </section>
  );
}
