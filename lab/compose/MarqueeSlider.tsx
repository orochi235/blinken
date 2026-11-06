import { type ControlRenderer, PropertyRow } from '@weasel-js/labkit';
import { Slider } from '@weasel-js/ui';
import { type CSSProperties, useEffect, useRef } from 'react';
import {
  AMBER,
  createOverlay,
  FACES,
  marginOf,
  type NumberParam,
  type Readout,
  rasterize,
  type Surface,
} from '@/index.js';
import { SMALL_SIGNS } from '../backend.js';
import './MarqueeSlider.css';
import { times } from './schema.js';

/** The face a readout's numbers are sized by: the sign's own 5 × 7, the clearest digits it has. */
const FACE = 'standard';
/** Fixed pitch, so a character is a run of columns and a space is a digit's width. */
const STYLE = { monospace: true } as const;
const ROWS = FACES[FACE].rows;

/**
 * The one overlay every slider's readout draws on, made with the first and kept across a hot
 * reload. It idles while nothing changes, so a page of sliders costs nothing per frame but
 * following their boxes.
 */
let shared: Surface | null = import.meta.hot?.data.readouts ?? null;
function overlay(): Surface {
  if (!shared) {
    shared = createOverlay({ backend: SMALL_SIGNS });
    if (import.meta.hot) import.meta.hot.data.readouts = shared;
  }
  return shared;
}

/** A value `typed` asks for, held to the range and on a step from `min`; null for no number. */
function typedValue(typed: string, min: number, max: number, step: number): number | null {
  const n = Number.parseFloat(typed);
  if (!Number.isFinite(n)) return null;
  const on = min + Math.round((Math.min(max, Math.max(min, n)) - min) / step) * step;
  return Number(on.toPrecision(12));
}

/**
 * A number on a small dot-matrix readout that edits: click it and type, and what is typed shows on
 * its dots. Enter or leaving commits, held to the range and its step; Escape puts the value back;
 * ↑ and ↓ step it, ten at a time with Shift.
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
  const slot = useRef<HTMLSpanElement>(null);
  const readout = useRef<Readout | null>(null);
  /** What is typed and not yet committed, or null. */
  const draft = useRef<string | null>(null);
  const latest = useRef({ value, text, onCommit });
  latest.current = { value, text, onCommit };

  useEffect(() => {
    if (!slot.current) return;
    const shown = () => latest.current.text.trim();
    const settle = () => {
      draft.current = null;
      readout.current?.set(shown());
    };
    const commit = () => {
      if (draft.current === null) return;
      const v = typedValue(draft.current, min, max, step);
      settle();
      if (v !== null && v !== latest.current.value) latest.current.onCommit(v);
    };
    const r = overlay().readout({
      type: 'matrix',
      cells: chars,
      align: 'right',
      color: AMBER,
      follow: slot.current,
      value: shown(),
      label,
      edit: !disabled,
      field: {
        role: 'spinbutton',
        inputmode: 'decimal',
        'aria-valuemin': String(min),
        'aria-valuemax': String(max),
        'aria-valuenow': String(latest.current.value),
      },
      onInput(typed) {
        const clean = typed.replace(/[^0-9.-]/g, '');
        draft.current = clean;
        if (clean !== typed) r.set(clean);
      },
      onKeyDown(e) {
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') settle();
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const by = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1) * step;
          const from = typedValue(draft.current ?? String(latest.current.value), min, max, step);
          const v = typedValue(String((from ?? latest.current.value) + by), min, max, step);
          settle();
          if (v !== null) latest.current.onCommit(v);
        } else return;
        e.preventDefault();
      },
      onBlur: commit,
    });
    readout.current = r;
    return () => {
      readout.current = null;
      r.destroy();
    };
  }, [chars, min, max, step, label, disabled]);

  useEffect(() => {
    if (draft.current === null) readout.current?.set(text.trim());
    readout.current?.setField({ 'aria-valuenow': String(value) });
  }, [text, value]);

  // The readout's size in dots is all that varies by slider; the pitch is the stylesheet's.
  const margin = marginOf(false);
  const size = { '--cols': cols + 2 * margin, '--rows': ROWS + 2 * margin } as CSSProperties;
  return <span ref={slot} className="marquee-readout" style={size} />;
}

/** How a NumberParam's shown value reads on a readout: its step's decimals, and its unit. */
const textOf = (p: NumberParam, shown: number) => {
  const k = p.scale ?? 1;
  const decimals = Math.max(0, -Math.floor(Math.log10(times(p.step, k)) + 1e-9));
  return `${shown.toFixed(decimals)}${p.unit ?? ''}`;
};

/**
 * A NumberParam's row with a small dot-matrix readout: the kit's slider over the param's range,
 * as the panel shows it (scaled), its value on the readout beside it, which can be typed into.
 */
export function marqueeSlider(p: NumberParam): ControlRenderer {
  const k = p.scale ?? 1;
  const min = times(p.min, k);
  const max = times(p.max, k);
  const step = times(p.step, k);
  // Wide enough for the widest value the param can hold, so the readout never resizes; a
  // shorter one aligns right.
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
              text={textOf(p, v)}
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
