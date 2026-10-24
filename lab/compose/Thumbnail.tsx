import { useEffect, useRef } from 'react';
import { createThumbnail, type EffectSpec, type Thumbnail as Handle } from '@/index.js';
import './Thumbnail.css';

/** A small sign looping `effect`, looked up in `effects` before the built-ins, animating while in view. */
export function Thumbnail({
  effect,
  effects,
}: {
  effect: string;
  effects: Readonly<Record<string, EffectSpec>>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<Handle | null>(null);
  const latest = useRef(effects);
  latest.current = effects;

  useEffect(() => {
    if (!canvas.current) return;
    const t = createThumbnail(canvas.current, { effect, effects: latest.current });
    thumb.current = t;
    return () => {
      thumb.current = null;
      t.destroy();
    };
  }, [effect]);

  // An edit to the effect plays from its next pass.
  const spec = Object.hasOwn(effects, effect) ? effects[effect] : undefined;
  useEffect(() => {
    if (spec) thumb.current?.marquee.setEffects(latest.current);
  }, [spec]);

  return (
    <div className="compose-thumbnail">
      <canvas ref={canvas} />
    </div>
  );
}
