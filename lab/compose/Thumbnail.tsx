import { useEffect, useRef } from 'react';
import {
  createThumbnail,
  type EffectSpec,
  type FaceName,
  type Thumbnail as Handle,
} from '@/index.js';
import './Thumbnail.css';

/**
 * A small sign looping `effect`, looked up in `effects` before the built-ins, animating while in
 * view; `text` and `face` change what it shows, and a new one is made for each.
 */
export function Thumbnail({
  effect,
  effects,
  text,
  face,
  cols,
}: {
  effect: string | EffectSpec;
  effects: Readonly<Record<string, EffectSpec>>;
  text?: string;
  face?: FaceName;
  cols?: number;
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
    });
    thumb.current = t;
    return () => {
      thumb.current = null;
      t.destroy();
    };
  }, [effect, text, face, cols]);

  // An edit to the effect plays from its next pass.
  const spec =
    typeof effect === 'string' && Object.hasOwn(effects, effect) ? effects[effect] : undefined;
  useEffect(() => {
    if (spec) thumb.current?.marquee.setEffects(latest.current);
  }, [spec]);

  return (
    <div className="compose-thumbnail">
      <canvas ref={canvas} />
    </div>
  );
}
