import {
  MODULATORS,
  MOVES,
  type ModulatorName,
  type MoveName,
  type Piece,
  type Slot,
  values,
} from '@/index.js';
import { controlFor, h, orderControls } from './controls.js';

/** The pieces a slot may hold: its own moves, then every modulator, as select values. */
export const choicesFor = (slot: Slot) => ({
  moves: (Object.keys(MOVES) as MoveName[]).filter((name) => MOVES[name].slot === slot),
  mods: Object.keys(MODULATORS) as ModulatorName[],
});

const MOD = 'mod:';

/** A `<select>` over the pieces `slot` may hold: move names, and modulators prefixed `mod:`. */
export function pieceSelect(slot: Slot, chosen?: Piece, first?: string): HTMLSelectElement {
  const select = h('select');
  if (first) {
    const o = h('option', undefined, first);
    o.value = '';
    select.append(o);
  }
  const { moves, mods } = choicesFor(slot);
  const group = (label: string, names: readonly string[], prefix: string, on?: string) => {
    const g = h('optgroup');
    g.label = label;
    for (const name of names) {
      const o = h('option', undefined, name);
      o.value = prefix + name;
      o.selected = name === on;
      g.append(o);
    }
    select.append(g);
  };
  group('moves', moves, '', chosen && 'move' in chosen ? chosen.move : undefined);
  group('modulators', mods, MOD, chosen && 'mod' in chosen ? chosen.mod : undefined);
  return select;
}

/** The fresh piece a `pieceSelect` value names. */
export const pieceOf = (value: string): Piece =>
  value.startsWith(MOD)
    ? { mod: value.slice(MOD.length) as ModulatorName }
    : { move: value as MoveName };

/**
 * One piece's card: what it is, its order or spread, and its settings. `onEdit` gets the edited
 * piece and whether the card must be rebuilt (it is another piece now).
 */
export function pieceCard(
  slot: Slot,
  piece: Piece,
  onEdit: (next: Piece, rebuild: boolean) => void,
  onRemove: () => void,
): HTMLElement {
  let now = piece;
  const thing = 'mod' in piece ? MODULATORS[piece.mod] : MOVES[piece.move];
  const select = pieceSelect(slot, piece);
  select.addEventListener('change', () => onEdit(pieceOf(select.value), true));
  const remove = h('button', 'small', 'remove');
  remove.type = 'button';
  remove.addEventListener('click', onRemove);
  const head = h('div', 'piece-head', select, h('span', 'about', thing.about), remove);

  const order =
    'mod' in piece
      ? orderControls(
          'spread',
          piece.spread,
          (spread) => {
            now = { ...(now as typeof piece), spread: spread ?? { by: 'together' } };
            onEdit(now, false);
          },
          { lag: false },
        )
      : orderControls('order', piece.order, (order) => {
          now = { ...(now as typeof piece), order: order ?? { by: 'together' } };
          onEdit(now, false);
        });

  const current = values(thing, piece.params as never) as Record<string, never>;
  const settings = Object.entries(thing.params).map(([key, param]) =>
    controlFor(key, param, current[key] as never, (v) => {
      now = { ...now, params: { ...now.params, [key]: v } };
      onEdit(now, false);
    }),
  );
  const perHold = slot === 'active' && 'ms' in thing.params ? perHoldRow() : [];
  return h(
    'div',
    `piece ${'mod' in piece ? 'is-mod' : 'is-move'}`,
    head,
    ...order,
    ...perHold,
    ...settings,
  );

  /** In `active`, a length left unset is one pass over the hold; a checkbox for that. */
  function perHoldRow(): HTMLElement[] {
    const msRow = settings.find((el) => el.dataset.key === 'ms');
    const box = h('input');
    box.type = 'checkbox';
    box.checked = piece.params?.ms === undefined;
    const sync = () => msRow?.classList.toggle('off', box.checked);
    box.addEventListener('change', () => {
      sync();
      const { ms: _, ...rest } = now.params ?? {};
      const ms = Number(msRow?.querySelector('input')?.value);
      const params = box.checked ? rest : { ...rest, ms };
      const { params: __, ...bare } = now;
      now = Object.keys(params).length ? { ...bare, params } : bare;
      onEdit(now, false);
    });
    sync();
    return [
      h('label', 'ctl', h('span', 'ctl-name', 'pass'), h('span', undefined, box, ' one per hold')),
    ];
  }
}
