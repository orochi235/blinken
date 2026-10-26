import { type ConfigShape, ControlPanel, f, isAuto } from '@weasel-js/labkit';
import {
  MODULATORS,
  MOVES,
  type NumberParam,
  ORDERS,
  type OrderBy,
  type Piece,
  type Slot,
  values,
} from '@/index.js';
import { RENDERERS } from '../ColorsRow.js';
import { IconButton } from '../IconButton.js';
import { PlainSelect } from '../PlainSelect.js';
import { DENSITY, fieldOf, numberField, schemaFor, shownValues, storedValue } from '../schema.js';
import { LAG } from '../state.js';
import { keyOf, pieceOf, pieceOptions } from './edit.js';
import './PieceCard.css';
import { usePickedBox } from './picking.js';

const NONE: ReadonlySet<string> = new Set();
const PER_HOLD: ReadonlySet<string> = new Set(['ms']);

const thingOf = (piece: Piece) => ('mod' in piece ? MODULATORS[piece.mod] : MOVES[piece.move]);

/** In `active` with a hold, a length left unset is one pass over the hold: its `ms` can be auto. */
const perHold = (slot: Slot, piece: Piece, hold: number | undefined) =>
  slot === 'active' && hold !== undefined && hold > 0 && 'ms' in thingOf(piece).params;

const schemaOf = (slot: Slot, piece: Piece, held: boolean) =>
  schemaFor(`${slot}:${keyOf(piece)}${held ? ':held' : ''}`, () => {
    const thing = thingOf(piece);
    const params = Object.fromEntries(
      Object.entries(thing.params).map(([key, p]) => [
        key,
        key === 'ms' && held
          ? numberField(p as NumberParam)
              .auto()
              .describe(`${p.about} Auto makes one pass over the hold.`)
          : fieldOf(p),
      ]),
    );
    const order: ConfigShape =
      'mod' in piece
        ? {
            spread: f
              .enum<OrderBy>('together', ORDERS)
              .label('spread')
              .describe(
                'How this piece’s timing is offset over the sign: by column, from the center out, by row, by letter, or at random. Together keeps every dot in step.',
              ),
          }
        : {
            order: f
              .enum<OrderBy>('together', ORDERS)
              .label('order')
              .describe(
                'Staggers this move over the sign: by column, from the center out, by row, letter by letter, or at random, each group a lag after the last. Together moves every dot at once.',
              ),
            lag: numberField(LAG),
          };
    return { ...order, ...params };
  });

/** One piece of a slot: which it is, its order or spread, and its settings. */
export function PieceCard({
  slot,
  piece,
  hold,
  onEdit,
  onRemove,
  picked,
  onPick,
}: {
  slot: Slot;
  piece: Piece;
  /** The effect's hold, which an `active` piece's unset length plays one pass over. */
  hold: number | undefined;
  onEdit: (fn: (now: Piece) => Piece) => void;
  onRemove: () => void;
  /** Whether the diagram has this piece picked. */
  picked: boolean;
  /** Picks this piece, as using any of its controls does. */
  onPick: () => void;
}) {
  const box = usePickedBox<HTMLDivElement>(picked);
  const thing = thingOf(piece);
  const config = {
    ...('mod' in piece
      ? { spread: piece.spread?.by ?? 'together' }
      : { order: piece.order?.by ?? 'together', lag: piece.order?.lag ?? 0 }),
    ...shownValues(thing.params, values(thing, piece.params as never)),
  };
  const set = (path: string, v: unknown) =>
    onEdit((now) => {
      if ('mod' in now && path === 'spread')
        return { ...now, spread: { ...now.spread, by: v as OrderBy } };
      if ('move' in now && path === 'order')
        return { ...now, order: { ...now.order, by: v as OrderBy } };
      if ('move' in now && path === 'lag')
        return { ...now, order: { ...(now.order ?? { by: 'together' }), lag: Number(v) } };
      const { [path]: _, ...rest } = now.params ?? {};
      const params = isAuto(v) ? rest : { ...rest, [path]: storedValue(thing.params, path, v) };
      const { params: __, ...bare } = now;
      return (Object.keys(params).length ? { ...bare, params } : bare) as Piece;
    });
  const held = perHold(slot, piece, hold);
  const auto = held && piece.params?.ms === undefined ? PER_HOLD : NONE;
  return (
    <div
      ref={box}
      className={'mod' in piece ? 'compose-piece is-mod' : 'compose-piece is-move'}
      data-picked={picked || undefined}
      onPointerDownCapture={onPick}
      onFocusCapture={onPick}
    >
      <div className="compose-piece-head">
        <PlainSelect
          aria-label="piece"
          options={pieceOptions(slot)}
          selectedKey={keyOf(piece)}
          onSelectionChange={(key) => onEdit(() => pieceOf(key))}
        />
        <span className="compose-about">{thing.about}</span>
        <IconButton glyph="remove" label="remove this piece" onClick={onRemove} />
      </div>
      <ControlPanel
        density={DENSITY}
        schema={schemaOf(slot, piece, held)}
        config={config}
        auto={auto}
        setConfig={set}
        draftConfig={set}
        renderers={RENDERERS}
        className="compose-two-up"
        pack="pairs"
        layout="inline"
      />
    </div>
  );
}
