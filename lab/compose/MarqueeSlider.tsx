import { type ControlRenderer, PropertyRow } from '@weasel-js/labkit';
import { Slider } from '@weasel-js/ui';
import { type CSSProperties, useEffect, useRef } from 'react';
import {
  createThumbnail,
  FACES,
  marginOf,
  type NumberParam,
  rasterize,
  type Thumbnail,
} from '@/index.js';
import './MarqueeSlider.css';
import { STILL } from './Thumbnail.js';

/** The face a readout's numbers are set in: the sign's own 5 × 7, the clearest digits it has. */
const FACE = 'standard';
const ROWS = FACES[FACE].rows;
const times = (n: number, by: number) => Number((n * by).toPrecision(12));

/**
 * A number as a small sign shows it, the sign kept for the life of the row: a new value is a new
 * program on the same sign, so the readout changes without being rebuilt.
 */
function Readout({ text, cols }: { text: string; cols: number }) {
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
    t.marquee.setProgram([{ effect: STILL, text, face: FACE, hex: 0xff9a2e }]);
    t.marquee.restart();
    t.play(false, 100);
  }, [text]);
  // The sign's size in dots is all that varies by readout; the pitch is the stylesheet's.
  const margin = marginOf(false);
  const size = { '--cols': cols + 2 * margin, '--rows': ROWS + 2 * margin } as CSSProperties;
  return (
    <span className="marquee-readout" style={size}>
      <canvas ref={canvas} />
    </span>
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
 * as the panel shows it (scaled), its value set on the sign beside it.
 */
export function marqueeSlider(p: NumberParam): ControlRenderer {
  const k = p.scale ?? 1;
  const min = times(p.min, k);
  const max = times(p.max, k);
  const step = times(p.step, k);
  // Wide enough for the widest value the param can hold, so the readout never resizes.
  const cols = Math.max(...[min, max].map((v) => rasterize(textOf(p, v), { face: FACE }).cols)) + 2;
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
            <Readout text={textOf(p, v).padStart(chars)} cols={cols} />
          </span>
        </PropertyRow>
      );
    },
    { group: true },
  );
}
