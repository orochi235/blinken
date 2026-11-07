import { type EffectSpec, piecesOf, type Slot } from '@/index.js';
import { PlainSelect } from '../PlainSelect.js';
import { addPiece, removePiece, setPiece } from '../state.js';
import { editEffect, pieceOf, pieceOptions } from './edit.js';
import { idOf } from './graph.js';
import { useDesk } from './open.js';
import { PieceCard } from './PieceCard.js';
import { usePickedBox } from './picking.js';

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
  const designer = useDesk();
  const step = idOf({ kind: 'step', slot });
  const box = usePickedBox<HTMLElement>(designer.picked() === step);
  return (
    <section
      ref={box}
      className={`compose-slot compose-slot-${slot}`}
      aria-label={slot}
      data-picked={designer.picked() === step || undefined}
    >
      <h3 className="compose-heading">{slot}</h3>
      {piecesOf(spec[slot]).map((piece, i) => (
        <PieceCard
          // biome-ignore lint/suspicious/noArrayIndexKey: a piece is its place in the slot
          key={`${i}:${'mod' in piece ? piece.mod : piece.move}`}
          slot={slot}
          piece={piece}
          // Every write reads the slot as it stands now, not the `spec` this card drew from.
          onEdit={(fn) =>
            editEffect(designer, (e) => {
              const now = piecesOf(e[slot])[i];
              return now ? setPiece(e, slot, i, fn(now)) : e;
            })
          }
          onRemove={() => editEffect(designer, (e) => removePiece(e, slot, i))}
          picked={designer.picked() === idOf({ kind: 'piece', slot, index: i })}
          onPick={() => designer.setPicked(idOf({ kind: 'piece', slot, index: i }))}
        />
      ))}
      <PlainSelect
        aria-label={`add a piece to ${slot}`}
        placeholder="add a piece…"
        options={pieceOptions(slot)}
        selectedKey={null}
        onSelectionChange={(key) => {
          if (key) editEffect(designer, (e) => addPiece(e, slot, pieceOf(key)));
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
