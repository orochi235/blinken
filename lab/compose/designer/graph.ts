import type { DataContainer, DataEdge, DataNode, DiagramData } from '@weasel-js/diagram';
import {
  type Channel,
  type EffectSpec,
  type Piece,
  piecesOf,
  SLOTS,
  type Slot,
  type Stretch,
  writesOf,
} from '@/index.js';

/** The three ways the diagram draws an effect. */
export type View = 'signal' | 'time' | 'both';
export const VIEWS: readonly View[] = ['signal', 'time', 'both'];

/** What a node of the diagram stands for. */
export type Part =
  | { kind: 'piece'; slot: Slot; index: number }
  | { kind: 'step'; slot: Slot }
  | { kind: 'channel'; channel: Channel }
  | { kind: 'sign' };

export function idOf(part: Part): string {
  switch (part.kind) {
    case 'piece':
      return `piece:${part.slot}:${part.index}`;
    case 'step':
      return `step:${part.slot}`;
    case 'channel':
      return `channel:${part.channel}`;
    case 'sign':
      return 'sign';
  }
}

const isSlot = (s: string | undefined): s is Slot => (SLOTS as readonly string[]).includes(s ?? '');

export function partOf(id: string): Part | null {
  if (id === 'sign') return { kind: 'sign' };
  const [head, a, b, ...rest] = id.split(':');
  if (rest.length > 0) return null;
  if (head === 'piece' && isSlot(a) && b !== undefined && /^\d+$/.test(b))
    return { kind: 'piece', slot: a, index: Number(b) };
  if (head === 'step' && isSlot(a) && b === undefined) return { kind: 'step', slot: a };
  if (head === 'channel' && a && b === undefined) return { kind: 'channel', channel: a as Channel };
  return null;
}

const nameOf = (p: Piece) => ('mod' in p ? p.mod : p.move);
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

/** Every piece of the effect with its id, in slot order. */
const piecesIn = (spec: EffectSpec) =>
  SLOTS.flatMap((slot) =>
    piecesOf(spec[slot]).map((piece, index) => ({
      id: idOf({ kind: 'piece', slot, index }),
      slot,
      piece,
    })),
  );

/** The effect as diagram data, in `view`; `parts` labels each step with its length. */
export function graphOf(
  spec: EffectSpec,
  view: View,
  parts: Readonly<Record<Slot, Stretch>> | null,
): DiagramData {
  const pieces = piecesIn(spec);
  const channels = [...new Set(pieces.flatMap(({ piece }) => writesOf(piece)))];
  const channelId = (channel: Channel) => idOf({ kind: 'channel', channel });
  const lengthOf = (slot: Slot) => (parts ? seconds(parts[slot].ms) : null);
  const edges: DataEdge[] = [];
  const join = (from: string, to: string, label?: string) =>
    edges.push({ id: `${from}>${to}`, from, to, ...(label && { label }) });
  const wires = () => {
    for (const { id, piece } of pieces) for (const c of writesOf(piece)) join(id, channelId(c));
  };
  const channelNodes = channels.map((c): DataNode => ({ id: channelId(c), lines: [c] }));
  const blend = `blend ${spec.blend ?? 0} ms`;
  const sequence = () => {
    join('step:enter', 'step:active', blend);
    join('step:active', 'step:exit', blend);
  };

  if (view === 'signal') {
    wires();
    for (const c of channels) join(channelId(c), 'sign');
    return {
      nodes: [
        ...pieces.map(({ id, slot, piece }) => ({ id, lines: [nameOf(piece), slot] })),
        ...channelNodes,
        { id: 'sign', lines: ['sign'] },
      ],
      edges,
    };
  }

  const pieceNodes = pieces.map(({ id, piece }) => ({ id, lines: [nameOf(piece)] }));

  if (view === 'time') {
    sequence();
    for (const { id, slot } of pieces) join(idOf({ kind: 'step', slot }), id);
    const steps = SLOTS.map(
      (slot): DataNode => ({
        id: idOf({ kind: 'step', slot }),
        lines: [slot, ...(lengthOf(slot) ? [lengthOf(slot) as string] : [])],
      }),
    );
    return { nodes: [...steps, ...pieceNodes], edges };
  }

  // Both: the steps are containers holding their pieces, under the same ids as time's step nodes.
  const containers = SLOTS.map(
    (slot): DataContainer => ({
      id: idOf({ kind: 'step', slot }),
      role: 'container',
      label: lengthOf(slot) ? `${slot} · ${lengthOf(slot)}` : slot,
      members: pieces.filter((p) => p.slot === slot).map((p) => p.id),
    }),
  );
  sequence();
  wires();
  return { nodes: [...pieceNodes, ...channelNodes], edges, containers };
}

/** The view a picked id is best seen in, or null where any will do. */
export function viewFor(id: string, spec: EffectSpec): View | null {
  const part = partOf(id);
  if (part?.kind === 'channel') return 'signal';
  if (part?.kind === 'step') return 'time';
  if (part?.kind === 'piece') {
    const piece = piecesOf(spec[part.slot])[part.index];
    return piece && 'mod' in piece ? 'signal' : null;
  }
  return null;
}
