import { useEffect, useRef } from 'react';
import {
  createThumbnail,
  type EffectSpec,
  type FaceName,
  type Thumbnail as Handle,
  type ThumbnailOptions,
} from '@/index.js';
import './Thumbnail.css';

/** The message standing still, so a preview shows the letters rather than an effect. */
export const STILL: EffectSpec = { name: 'still', active: { move: 'stand' } };
/** Far enough into a pass that most effects have come on, for a still of the effect itself. */
export const MIDWAY = { share: 0.4 } as const;
/** No designed effects, for a thumbnail that plays a spec of its own. */
export const NO_EFFECTS: Readonly<Record<string, EffectSpec>> = {};

/**
 * A small sign looping `effect`, looked up in `effects` before the built-ins, animating while in
 * view, or drawn once at `still`; `text` and `face` change what it shows, and a new one is made
 * for each.
 */
export function Thumbnail({
  effect,
  effects,
  text,
  face,
  cols,
  rows,
  still,
  hex,
}: {
  effect: string | EffectSpec;
  effects: Readonly<Record<string, EffectSpec>>;
  text?: string;
  face?: FaceName;
  cols?: number;
  rows?: number;
  still?: ThumbnailOptions['still'];
  hex?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<Handle | null>(null);
  const latest = useRef(effects);
  latest.current = effects;

  useEffect(() => {
    if (!canvas.current) return;
    const t = createThumbnail(canvas.current, {
      effect,
      effects: latest.current,
      text,
      face,
      cols,
      rows,
      still,
      hex,
    });
    thumb.current = t;
    return () => {
      thumb.current = null;
      t.destroy();
    };
  }, [effect, text, face, cols, rows, still, hex]);

  // An edit to the effect plays from its next pass.
  const spec =
    typeof effect === 'string' && Object.hasOwn(effects, effect) ? effects[effect] : undefined;
  useEffect(() => {
    if (spec) thumb.current?.marquee.setEffects(latest.current);
  }, [spec]);

  return (
    // A span, so a thumbnail can stand inside a button.
    <span className="compose-thumbnail">
      <canvas ref={canvas} />
    </span>
  );
}
