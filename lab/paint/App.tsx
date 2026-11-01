import { Button, LabShell, useUndoKeys } from '@weasel-js/labkit';
import { useEffect, useRef, useState } from 'react';
import { GRIDS, type GridName } from '@/index.js';
import { IconButton } from '../compose/IconButton.js';
import { PAGES } from '../pages.js';
import { type Brush, createPainter, type Layout } from './painter.js';
import { paint, usePaint } from './store.js';
import './App.css';

/** Lite-Brite's pegs, and white. */
const PALETTE = {
  red: 0xff3030,
  orange: 0xff8a1e,
  yellow: 0xffe23a,
  green: 0x4dff5a,
  blue: 0x3a8cff,
  violet: 0xb05aff,
  pink: 0xff5ac8,
  white: 0xffffff,
} as const;
type Swatch = keyof typeof PALETTE | 'custom' | 'erase';

const hexOf = (s: string) => Number.parseInt(s.slice(1), 16);

/** The paint page: a board of LEDs to light dot by dot, MS Paint style. */
export function App() {
  const { layout } = usePaint();
  const [swatch, setSwatch] = useState<Swatch>('red');
  const [custom, setCustom] = useState('#40e0d0');
  const [size, setSize] = useState(1);
  useUndoKeys(paint);

  const brush = useRef<Brush>({ hex: PALETTE.red, size: 1 });
  brush.current = {
    hex: swatch === 'erase' ? null : swatch === 'custom' ? hexOf(custom) : PALETTE[swatch],
    size,
  };

  return (
    <LabShell title="bree paint" mode="dark" pages={PAGES} header={<LayoutBar layout={layout} />}>
      <div className="paint-page">
        <div className="paint-tools">
          {(Object.keys(PALETTE) as (keyof typeof PALETTE)[]).map((name) => (
            <button
              key={name}
              type="button"
              className="paint-swatch"
              data-color={name}
              aria-label={name}
              title={name}
              aria-pressed={swatch === name}
              onClick={() => setSwatch(name)}
            />
          ))}
          <label
            className="paint-swatch paint-custom"
            title="a color of your own"
            data-on={swatch === 'custom'}
          >
            <input
              type="color"
              value={custom}
              aria-label="a color of your own"
              onClick={() => setSwatch('custom')}
              onChange={(e) => {
                setCustom(e.currentTarget.value);
                setSwatch('custom');
              }}
            />
          </label>
          <button
            type="button"
            className="paint-swatch paint-erase"
            aria-label="erase"
            title="erase (or drag with the right button)"
            aria-pressed={swatch === 'erase'}
            onClick={() => setSwatch('erase')}
          />
          <label className="paint-size" title="How many dots across the brush paints.">
            brush
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={size}
              onChange={(e) => setSize(Number(e.currentTarget.value))}
            />
            <output className="paint-readout">{size}</output>
          </label>
          <IconButton glyph="undo" label="undo" disabled={!paint.canUndo()} onClick={paint.undo} />
          <IconButton glyph="redo" label="redo" disabled={!paint.canRedo()} onClick={paint.redo} />
          <Button
            size="sm"
            tooltip="Turn every dot off. Undo brings them back."
            onClick={paint.clear}
          >
            clear
          </Button>
        </div>
        <Board layout={layout} brush={brush} />
      </div>
    </LabShell>
  );
}

/** The board, rebuilt for each layout; the picture it shows follows the store. */
function Board({ layout, brush }: { layout: Layout; brush: { current: Brush } }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { cols, rows, grid } = layout;

  useEffect(() => {
    if (!canvas.current) return;
    const p = createPainter(
      canvas.current,
      { cols, rows, grid },
      paint.get().picture,
      () => brush.current,
      paint.setPicture,
    );
    const off = paint.subscribe(() => p.setPicture(paint.get().picture));
    return () => {
      off();
      p.destroy();
    };
  }, [cols, rows, grid, brush]);

  return (
    <div className="paint-board">
      <canvas ref={canvas} />
    </div>
  );
}

/** The board's shape: its grid and how many dots across and down. */
function LayoutBar({ layout }: { layout: Layout }) {
  const number = (key: 'cols' | 'rows', label: string, max: number) => (
    <label className="paint-field">
      {label}
      <input
        type="number"
        min={4}
        max={max}
        value={layout[key]}
        onChange={(e) => {
          const v = Math.floor(Number(e.currentTarget.value));
          if (v >= 4 && v <= max) paint.setLayout({ ...layout, [key]: v });
        }}
      />
    </label>
  );
  return (
    <div className="paint-bar">
      <label className="paint-field">
        grid
        <select
          value={layout.grid}
          onChange={(e) => paint.setLayout({ ...layout, grid: e.currentTarget.value as GridName })}
        >
          {Object.keys(GRIDS).map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      {number('cols', 'columns', 200)}
      {number('rows', 'rows', 120)}
    </div>
  );
}
