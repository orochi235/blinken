import { dragItemProps } from '@weasel-js/diagram';
import { DragGhost } from '@weasel-js/ui';
import { type PointerEvent, useRef, useState } from 'react';
import {
  MODULATORS,
  MOVES,
  type ModulatorName,
  type MoveName,
  type Piece,
  piecesOf,
  SLOTS,
  type Slot,
} from '@/index.js';
import { partOf } from './graph.js';
import { commitEdit, openSpec } from './graphEdits.js';
import { useDesk } from './open.js';
import './PiecePalette.css';

/** How far a press moves, in CSS pixels, before it is a drag rather than a click. */
const SLOP = 4;

type Ghost = { label: string; from: Element; at: { left: number; top: number } };

const GROUPS: readonly { title: string; pieces: readonly Piece[] }[] = [
  ...SLOTS.map((slot) => ({
    title: slot,
    pieces: (Object.keys(MOVES) as MoveName[])
      .filter((m) => MOVES[m].slot === slot)
      .map((move): Piece => ({ move })),
  })),
  {
    title: 'modulators',
    pieces: (Object.keys(MODULATORS) as ModulatorName[]).map((mod): Piece => ({ mod })),
  },
];

const nameOf = (p: Piece) => ('mod' in p ? p.mod : p.move);
const aboutOf = (p: Piece) => ('mod' in p ? MODULATORS[p.mod].about : MOVES[p.move].about);

/**
 * Every move and modulator, to drag onto a step of the effect diagram. A click adds one instead: a
 * move to its own step, a modulator to the step picked, or to active.
 */
export function PiecePalette() {
  const designer = useDesk();
  const [ghost, setGhost] = useState<Ghost | null>(null);
  // Set while the click that ends a drag is still to come, so the drag does not also add.
  const dragged = useRef(false);
  const picked = designer.picked();
  const part = picked === undefined ? null : partOf(picked);
  const pickedStep: Slot | null =
    part?.kind === 'step' || part?.kind === 'piece' ? part.slot : null;
  const add = (piece: Piece) => {
    const spec = openSpec(designer);
    if (!spec || dragged.current) return;
    const slot = 'move' in piece ? MOVES[piece.move].slot : (pickedStep ?? 'active');
    commitEdit(designer, { kind: 'add', piece, to: { slot, index: piecesOf(spec[slot]).length } });
  };
  const carry = (piece: Piece, label: string) => (e: PointerEvent<HTMLButtonElement>) => {
    const from = e.currentTarget;
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    dragItemProps(piece, {
      onMove: (m) => {
        moved ||= Math.hypot(m.clientX - start.x, m.clientY - start.y) > SLOP;
        if (moved) setGhost({ label, from, at: { left: m.clientX, top: m.clientY } });
      },
      onEnd: () => {
        setGhost(null);
        if (!moved) return;
        dragged.current = true;
        setTimeout(() => {
          dragged.current = false;
        });
      },
      onCancel: () => setGhost(null),
    }).onPointerDown(e);
  };
  return (
    <section className="designer-palette" aria-label="pieces to add">
      {GROUPS.map(({ title, pieces }) => (
        <div key={title} className="designer-palette-group">
          <span className="designer-palette-title">{title}</span>
          <ul aria-label={title}>
            {pieces.map((piece) => {
              const label = nameOf(piece);
              return (
                <li key={label}>
                  <button
                    type="button"
                    className="designer-palette-piece"
                    title={`${aboutOf(piece)} Drag it onto a step, or click to add it.`}
                    onPointerDown={carry(piece, label)}
                    onClick={() => add(piece)}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {ghost && (
        <DragGhost at={ghost.at} from={ghost.from} centered>
          <span className="designer-palette-ghost">{ghost.label}</span>
        </DragGhost>
      )}
    </section>
  );
}
