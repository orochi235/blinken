import { type ControlRenderer, PropertyRow } from '@weasel-js/labkit';
import { Slider } from '@weasel-js/ui';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AMBER,
  createThumbnail,
  FACES,
  marginOf,
  type NumberParam,
  rasterize,
  type Thumbnail,
} from '@/index.js';
import './MarqueeSlider.css';
import { times } from './schema.js';
import { STILL } from './Thumbnail.js';

/** The face a readout's numbers are set in: the sign's own 5 × 7, the clearest digits it has. */
const FACE = 'standard';
/** Fixed pitch, so a character is a run of columns and a space is a digit's width. */
const STYLE = { monospace: true } as const;
const ROWS = FACES[FACE].rows;

/**
 * A number as a small sign shows it, the sign kept for the life of the row: a new value is a new
 * program on the same sign, so the readout changes without being rebuilt.
 */
function Readout({
  text,
  cols,
  marked = null,
  children,
}: {
  text: string;
  cols: number;
  /** Characters of `text` to draw swapped, `from` up to `to`; with the two equal, a caret before `from`. */
  marked?: { from: number; to: number } | null;
  children?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sign = useRef<Thumbnail | null>(null);
  const shown = useRef(text);
  shown.current = text;
  useEffect(() => {
    if (!canvas.current) return;
    const t = createThumbnail(canvas.current, {
      effect: STILL,
      effects: {},
      text: shown.current,
      face: FACE,
      style: STYLE,
      cols,
      rows: ROWS,
      still: 100,
    });
    sign.current = t;
    return () => {
      sign.current = null;
      t.destroy();
    };
  }, [cols]);
  useEffect(() => {
    const t = sign.current;
    if (!t) return;
    t.marquee.setProgram([{ effect: STILL, text, face: FACE, style: STYLE, hex: AMBER }]);
    t.marquee.restart();
    t.play(false, 100);
  }, [text]);
  // The sign's size in dots is all that varies by readout; the pitch is the stylesheet's.
  const margin = marginOf(false);
  const size = { '--cols': cols + 2 * margin, '--rows': ROWS + 2 * margin } as CSSProperties;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a selection is the same while its ends are.
  useEffect(() => {
    const t = sign.current;
    if (!t) return;
    if (!marked) {
      t.marquee.setHighlight(null);
      return;
    }
    const advance = FACES[FACE].width + 1;
    const left = Math.floor((cols - rasterize(text, { face: FACE, style: STYLE }).cols) / 2);
    const from = left + marked.from * advance;
    const to = left + marked.to * advance - 1;
    // A selection inverts a column of padding either side of its digits.
    t.marquee.setHighlight(
      marked.from === marked.to
        ? (dot) => dot.x === Math.max(0, from - 1)
        : (dot) => dot.x >= from - 1 && dot.x <= to,
    );
  }, [marked?.from, marked?.to, text, cols]);
  return (
    <span className="marquee-readout" style={size}>
      <canvas ref={canvas} />
      {children}
    </span>
  );
}

/** A value `typed` asks for, held to the range and on a step from `min`; null for no number. */
function typedValue(typed: string, min: number, max: number, step: number): number | null {
  const n = Number.parseFloat(typed);
  if (!Number.isFinite(n)) return null;
  const on = min + Math.round((Math.min(max, Math.max(min, n)) - min) / step) * step;
  return Number(on.toPrecision(12));
}

/**
 * A readout that edits: a see-through field over the sign, so what is typed shows on its dots.
 * Enter or leaving commits, held to the range and its step; Escape puts the value back; ↑ and ↓
 * step it, ten at a time with Shift.
 */
function ReadoutField({
  label,
  value,
  text,
  chars,
  cols,
  min,
  max,
  step,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  text: string;
  chars: number;
  cols: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null);
  const typed = draft ?? text.trim();
  // The field holds the bare value; the sign shows it padded on the left, so selections shift.
  const pad = chars - Math.min(chars, typed.length);
  const track = (el: HTMLInputElement) =>
    setSelection({ from: (el.selectionStart ?? 0) + pad, to: (el.selectionEnd ?? 0) + pad });
  const commit = () => {
    if (draft === null) return;
    const v = typedValue(draft, min, max, step);
    setDraft(null);
    if (v !== null && v !== value) onCommit(v);
  };
  const shown = (draft ?? text).slice(-chars).padStart(chars);
  return (
    <Readout text={shown} cols={cols} marked={selection}>
      <input
        className="marquee-readout-field"
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        disabled={disabled}
        value={typed}
        maxLength={chars}
        onFocus={(e) => {
          e.currentTarget.select();
          track(e.currentTarget);
        }}
        onSelect={(e) => track(e.currentTarget)}
        onChange={(e) => setDraft(e.currentTarget.value.replace(/[^0-9.-]/g, ''))}
        onBlur={() => {
          setSelection(null);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setDraft(null);
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const by = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) * step;
            const from = typedValue(draft ?? String(value), min, max, step) ?? value;
            const v = typedValue(String(from + by), min, max, step);
            setDraft(null);
            if (v !== null) onCommit(v);
          } else return;
          e.preventDefault();
        }}
      />
    </Readout>
  );
}

/** How a NumberParam's shown value reads on a readout: its step's decimals, and its unit. */
const textOf = (p: NumberParam, shown: number) => {
  const k = p.scale ?? 1;
  const decimals = Math.max(0, -Math.floor(Math.log10(times(p.step, k)) + 1e-9));
  return `${shown.toFixed(decimals)}${p.unit ?? ''}`;
};

/**
 * A NumberParam's row with a small sign for its readout: the kit's slider over the param's range,
 * as the panel shows it (scaled), its value set on the sign beside it, which can be typed into.
 */
export function marqueeSlider(p: NumberParam): ControlRenderer {
  const k = p.scale ?? 1;
  const min = times(p.min, k);
  const max = times(p.max, k);
  const step = times(p.step, k);
  // Wide enough for the widest value the param can hold, so the readout never resizes; a
  // shorter one is padded on the left. Two columns a side leave a dark one beyond a selection's padding.
  const chars = Math.max(...[min, max].map((v) => textOf(p, v).length));
  const cols = rasterize('0'.repeat(chars), { face: FACE, style: STYLE }).cols + 4;
  return Object.assign(
    ({ value, setValue, pref, disabled }: Parameters<ControlRenderer>[0]) => {
      const v = typeof value === 'number' ? value : min;
      return (
        <PropertyRow
          group
          layout="inline"
          label={pref.name ?? p.label}
          description={pref.description}
          disabled={disabled}
        >
          <span className="marquee-slider">
            <Slider
              ariaLabel={pref.name ?? p.label}
              min={min}
              max={max}
              step={step}
              thumbs={[{ value: v }]}
              readoutPlacement="none"
              onInput={(next) => setValue(next[0]?.value ?? v)}
            />
            <ReadoutField
              label={`${pref.name ?? p.label}, typed`}
              value={v}
              text={textOf(p, v).padStart(chars)}
              chars={chars}
              cols={cols}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              onCommit={setValue}
            />
          </span>
        </PropertyRow>
      );
    },
    { group: true },
  );
}
