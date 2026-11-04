import { useEffect, useRef } from 'react';
import {
  createThumbnail,
  type EffectSpec,
  type FaceName,
  type Follow,
  type Thumbnail as Handle,
  type TextStyle,
  type ThumbnailOptions,
} from '@/index.js';
import { SMALL_SIGNS } from '../backend.js';
import './Thumbnail.css';

/** The message standing still, so a preview shows the letters rather than an effect. */
export const STILL: EffectSpec = { name: 'still', active: { move: 'stand' } };
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
  style,
  cols,
  rows,
  still,
  playing = false,
  rewind = false,
  housing,
  follow,
  hex,
  onHandle,
}: {
  effect: string | EffectSpec;
  effects: Readonly<Record<string, EffectSpec>>;
  text?: string;
  face?: FaceName;
  style?: TextStyle;
  cols?: number;
  rows?: number;
  still?: ThumbnailOptions['still'];
  /** For a still: plays on from the moment it shows while true, and holds where it got to after. */
  playing?: boolean;
  /** Goes back to the still when `playing` ends, rather than holding where it got to. */
  rewind?: boolean;
  /** False lets the page show between the dots. */
  housing?: boolean;
  /** A sign whose planes it wears; kept the same object across renders, or it is rebuilt each time. */
  follow?: Follow;
  hex?: number;
  /** Given the thumbnail each time one is made, and null as it goes, for a caller that drives it. */
  onHandle?: (t: Handle | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<Handle | null>(null);
  const latest = useRef(effects);
  latest.current = effects;
  const wanted = useRef(playing);
  wanted.current = playing;
  const handed = useRef(onHandle);
  handed.current = onHandle;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a style is the same while its flags are.
  useEffect(() => {
    if (!canvas.current) return;
    const t = createThumbnail(canvas.current, {
      effect,
      effects: latest.current,
      text,
      face,
      style,
      cols,
      rows,
      still,
      housing,
      follow,
      hex,
      backend: SMALL_SIGNS,
    });
    thumb.current = t;
    if (wanted.current) t.play(true);
    handed.current?.(t);
    return () => {
      handed.current?.(null);
      thumb.current = null;
      t.destroy();
    };
  }, [
    effect,
    text,
    face,
    style?.monospace,
    style?.outline,
    style?.shadow,
    style?.tracking,
    cols,
    rows,
    still,
    housing,
    follow,
    hex,
  ]);

  const rewinds = useRef(rewind);
  rewinds.current = rewind;
  useEffect(() => {
    thumb.current?.play(playing, !playing && rewinds.current ? 'still' : undefined);
  }, [playing]);

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
