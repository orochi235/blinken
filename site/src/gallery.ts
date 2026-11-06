import {
  EFFECTS,
  type EffectSpec,
  LAYERS,
  MODULATORS,
  MOVES,
  type Param,
  type Params,
} from '@msb235/blinken';

export type CardKind = 'effect' | 'layer' | 'move' | 'modulator';

export interface Card {
  kind: CardKind;
  name: string;
  about: string;
  params: Params;
}

const of = (kind: CardKind, list: Readonly<Record<string, { name: string; about?: string; params?: Params }>>) =>
  Object.values(list).map((x): Card => ({ kind, name: x.name, about: x.about ?? '', params: x.params ?? {} }));

/** Every built-in a gallery card shows, grouped by what it is. */
export const CARDS: Record<CardKind, Card[]> = {
  effect: of('effect', EFFECTS),
  layer: Object.entries(LAYERS).map(([name, l]) => ({
    kind: 'layer',
    name,
    about: MODULATORS[l.mod as keyof typeof MODULATORS]?.about ?? '',
    params: {},
  })),
  move: of('move', MOVES),
  modulator: of('modulator', MODULATORS),
};

/** What a card's thumbnail loops: the effect itself, or the piece standing in a plain one. */
export function specOf(kind: CardKind, name: string): string | EffectSpec {
  if (kind === 'effect' || kind === 'layer') return kind === 'effect' ? name : 'still';
  if (kind === 'modulator')
    return { name, active: [{ move: 'stand' }, { mod: name }], hold: 3000 };
  const move = MOVES[name as keyof typeof MOVES];
  if (move.slot === 'active') return { name, active: { move: name }, hold: 2400 };
  return { name, [move.slot]: { move: name }, active: { move: 'stand' }, hold: 900 };
}

/** The still effect a layer's card plays under it. */
export const STILL: EffectSpec = { name: 'still', active: { move: 'stand' }, hold: 4000 };

/** A setting's range and default, as a control would offer it. */
export function rangeOf(p: Param): string {
  if ('colors' in p) return `${p.colors.length} colors`;
  if ('choices' in p) return `${p.choices.join(', ')}; default ${p.value}`;
  const s = p.scale ?? 1;
  const unit = p.unit ? ` ${p.unit}` : '';
  return `${p.min * s} to ${p.max * s}${unit}; default ${p.value * s}${unit}`;
}
