import { Button, LabShell, useUndoKeys } from '@weasel-js/labkit';
import { useEffect, useRef, useState } from 'react';
import { GRIDS, type GridName } from '@/index.js';
import { IconButton } from '../compose/IconButton.js';
import { numOf } from '../compose/schema.js';
import { PAGES } from '../pages.js';
import { FileButtons } from './FileButtons.js';
import { LampsBar } from './LampsBar.js';
import {
  type Brush,
  type LampSettings,
  type Layout,
  lampsOf,
  MAX_COLS,
  onGrid,
  type Shape,
  type Tool,
} from './model.js';
import { PALETTE, Palette, type Swatch } from './Palette.js';
import { createPainter, type Painter } from './painter.js';
import { paint, usePaint } from './store.js';
import { TextBar } from './TextBar.js';
import { Tools } from './Tools.js';
import './App.css';

/** The paint page: a board of LEDs to light dot by dot, MS Paint style. */
export function App() {
  const { layout, lamps, stamps, picked } = usePaint();
  const [swatch, setSwatch] = useState<Swatch>('red');
  const [custom, setCustom] = useState('#40e0d0');
  const [tool, setTool] = useState<Tool>('paint');
  const [shape, setShape] = useState<Shape>('round');
  const [size, setSize] = useState(1);
  const [level, setLevel] = useState(1);
  useUndoKeys(paint);

  const hex = swatch === 'custom' ? numOf(custom) : PALETTE[swatch];
  const brush = useRef<Brush>({ tool, hex, level, size, shape });
  brush.current = { tool, hex, level, size, shape };
  const stamp = stamps.find((s) => s.id === picked) ?? null;
  const editing = tool === 'text' && stamp !== null;

  return (
    <LabShell
      title="blinken paint"
      mode="dark"
      pages={PAGES}
      header={<LayoutBar layout={layout} />}
    >
      <div className="paint-page">
        <LampsBar lamps={lamps} />
        <div className="paint-row">
          <Palette
            swatch={swatch}
            custom={custom}
            onSwatch={(s) => {
              setSwatch(s);
              if (editing && s !== 'custom') paint.editPicked({ hex: PALETTE[s] });
            }}
            onCustom={(css) => {
              setCustom(css);
              if (editing) paint.editPicked({ hex: numOf(css) });
            }}
          />
          <IconButton glyph="undo" label="undo" disabled={!paint.canUndo()} onClick={paint.undo} />
          <IconButton glyph="redo" label="redo" disabled={!paint.canRedo()} onClick={paint.redo} />
          <Button
            size="sm"
            tooltip="Turn every dot off. Undo brings them back."
            onClick={paint.clear}
          >
            clear
          </Button>
          <FileButtons />
        </div>
        <Tools
          tool={tool}
          shape={shape}
          size={size}
          level={level}
          onTool={setTool}
          onShape={setShape}
          onSize={setSize}
          onLevel={(n) => {
            setLevel(n);
            if (editing) paint.editPicked({ level: n });
          }}
        />
        {tool === 'text' && <TextBar picked={stamp} layout={layout} hex={hex} level={level} />}
        <Board layout={layout} lamps={lamps} brush={brush} tool={tool} />
      </div>
    </LabShell>
  );
}

/** The board, rebuilt for each layout; the picture it shows follows the store. */
function Board({
  layout,
  lamps,
  brush,
  tool,
}: {
  layout: Layout;
  lamps: LampSettings;
  brush: { current: Brush };
  tool: Tool;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const painter = useRef<Painter | null>(null);
  const { cols, rows, grid } = layout;

  useEffect(() => {
    if (!canvas.current || !overlay.current || !preview.current) return;
    const p = createPainter(
      canvas.current,
      overlay.current,
      preview.current,
      { cols, rows, grid },
      paint.get(),
      {
        brush: () => brush.current,
        onPaint: paint.setPicture,
        onStamps: (s) => paint.setStamps(s),
        onPick: paint.pick,
      },
    );
    p.setLamps(lampsOf(paint.get().lamps));
    painter.current = p;
    const off = paint.subscribe(() => p.show(paint.get()));
    return () => {
      off();
      p.destroy();
      painter.current = null;
    };
  }, [cols, rows, grid, brush]);

  useEffect(() => painter.current?.setLamps(lampsOf(lamps)), [lamps]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the outline follows the tool, read through the brush ref.
  useEffect(() => painter.current?.redraw(), [tool]);

  return (
    <div className="paint-frame">
      <div className="paint-board" data-fit={lamps.fit}>
        <div className="paint-stage" data-tool={tool}>
          <canvas ref={canvas} />
          <canvas ref={overlay} className="paint-overlay" />
        </div>
      </div>
      <div className="paint-preview" title="The picture at a small size">
        <canvas ref={preview} />
      </div>
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
    <div className="paint-row">
      <label className="paint-field">
        grid
        <select
          value={layout.grid}
          onChange={(e) => paint.setLayout(onGrid(layout, e.currentTarget.value as GridName))}
        >
          {Object.keys(GRIDS).map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
      {number('cols', 'columns', MAX_COLS)}
      {number('rows', 'rows', 120)}
    </div>
  );
}
