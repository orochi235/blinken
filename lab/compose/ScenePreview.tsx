import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  board,
  type EffectSpec,
  type FaceName,
  marginOf,
  ROWS,
  rasterize,
  rowsToShow,
  type Scene,
} from '@/index.js';
import './ScenePreview.css';
import { Thumbnail } from './Thumbnail.js';

/** A preview's dot pitch, px: every scene's dots are this size, and a long message runs off the end. */
const PITCH = 3;

/**
 * A scene as a small sign the width of its row, at a fixed dot size, so a long message clips
 * rather than shrinking: held on the moment that best shows its effect, and playing its scene round
 * while `live`.
 */
export function ScenePreview({
  scene,
  effects,
  live,
}: {
  scene: Scene;
  effects: Readonly<Record<string, EffectSpec>>;
  live: boolean;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(() => setWidth(el.clientWidth));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const margin = marginOf(false);
  const cols = Math.max(4, Math.floor(width / PITCH) - 2 * margin);
  const rows = rowsToShow(board(cols, ROWS, false), rasterize(scene.text, scene));
  // The sign's size in dots is all that varies by scene.
  const size = {
    '--pitch': `${PITCH}px`,
    '--cols': cols + 2 * margin,
    '--rows': rows + 2 * margin,
  } as CSSProperties;
  return (
    <span ref={box} className="compose-scene-preview" style={size}>
      {width > 0 && (
        <Thumbnail
          effect={String(scene.effect)}
          effects={effects}
          text={scene.text}
          face={typeof scene.face === 'string' ? (scene.face as FaceName) : undefined}
          style={scene.style}
          hex={scene.hex}
          cols={cols}
          rows={rows}
          still="action"
          playing={live}
          rewind
        />
      )}
    </span>
  );
}
