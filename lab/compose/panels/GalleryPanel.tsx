import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { FaceName } from '@/index.js';
import { useLive } from '../live.js';
import { Panel } from '../Panel.js';
import { effectTitle } from '../schema.js';
import { pickedOf, playEffect, useCompose, useEffects } from '../store.js';
import { Thumbnail } from '../Thumbnail.js';
import { type EffectTile, tilesOf } from '../tiles.js';
import './GalleryPanel.css';

/** What a tile's sign shows: the picked scene's message, in its face and color. */
interface Message {
  text: string;
  face?: FaceName;
  hex?: number;
}

/** Every tile's sign is this many dots across, whatever the message: it scrolls or clips as its effect does. */
const COLS = 32;

/** Every effect in one scrolling strip, held still until the strip is hovered; picking one plays it on the picked scene. */
export function GalleryPanel() {
  const tiles = tilesOf(useEffects());
  const state = useCompose();
  const scene = state.program[pickedOf(state)];
  const text = scene?.text.trim() || 'OPEN';
  const face = typeof scene?.face === 'string' ? (scene.face as FaceName) : undefined;
  const message: Message = {
    text,
    face,
    hex: scene?.hex,
  };
  return (
    <Panel title="effects" className="compose-strip">
      <Strip
        label="every effect"
        items={(copy, live) =>
          tiles.map((t) => (
            <li key={t.key}>
              <StripTile tile={t} message={message} copy={copy} live={live} />
            </li>
          ))
        }
      />
    </Panel>
  );
}

/** How far a press moves before it is a drag rather than a click, px. */
const DRAG_PX = 4;
/** What a fling keeps of its speed each 16 ms. */
const FRICTION = 0.94;
/** How long the pointer may rest before letting go and still fling, ms. */
const STILL_MS = 80;

/**
 * A row that scrolls sideways under a thin bar of its own, drawn over the tiles rather than below
 * them. A vertical wheel scrolls it too, it and its bar drag, and a row wider than its box wraps:
 * it is drawn three times, and the scroll is kept in the middle copy.
 */
function Strip({
  label,
  items,
}: {
  label: string;
  /** The tiles, given whether they are a copy for the wrap and whether the strip is playing. */
  items: (copy: boolean, live: boolean) => ReactNode;
}) {
  const { live, on } = useLive();
  const box = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLUListElement>(null);
  const [wraps, setWraps] = useState(false);
  const [bar, setBar] = useState({ at: 0, size: 1 });
  /** One copy's width, gap included: how far the scroll jumps to stay in the middle. */
  const period = () => {
    const el = box.current;
    const set = main.current;
    if (!el || !set) return 0;
    return set.offsetWidth + Number.parseFloat(getComputedStyle(el).columnGap || '0');
  };
  const settle = () => {
    const el = box.current;
    if (!el) return;
    const p = period();
    if (wraps && p > 0) {
      if (el.scrollLeft < p * 0.5) el.scrollLeft += p;
      else if (el.scrollLeft > p * 1.5) el.scrollLeft -= p;
      const at = ((((el.scrollLeft - p) / p) % 1) + 1) % 1;
      const size = el.clientWidth / p;
      setBar({ at: Math.min(at, 1 - size), size });
    } else setBar({ at: el.scrollLeft / el.scrollWidth, size: el.clientWidth / el.scrollWidth });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: settle and period read only refs and `wraps`.
  useEffect(() => {
    const el = box.current;
    const set = main.current;
    if (!el || !set) return;
    const refit = () => {
      const over = set.offsetWidth > el.clientWidth;
      if (over !== wraps) setWraps(over);
      else settle();
    };
    refit();
    if (wraps) el.scrollLeft = period();
    const resized = new ResizeObserver(refit);
    resized.observe(el);
    resized.observe(set);
    // Passive listeners can't take the page's vertical scroll, so the wheel is bound by hand.
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      resized.disconnect();
      el.removeEventListener('wheel', wheel);
    };
  }, [wraps]);

  /** The coast a fling left running, stopped by the next press. */
  const coast = useRef(0);
  useEffect(() => () => cancelAnimationFrame(coast.current), []);
  /**
   * Scrolls by the pointer's motion from `e` on, `by` scroll px per pointer px; with `fling`, a
   * release mid-motion coasts on and slows to a stop.
   */
  const follow = (
    e: PointerEvent<HTMLElement>,
    by: () => number,
    { onDrag, fling = false }: { onDrag?: () => void; fling?: boolean } = {},
  ) => {
    const el = box.current;
    if (!el || e.button !== 0) return;
    cancelAnimationFrame(coast.current);
    const target = e.currentTarget;
    const start = e.clientX;
    let last = { x: e.clientX, t: e.timeStamp };
    /** Pointer px per ms, smoothed over the last few moves. */
    let speed = 0;
    let dragging = false;
    const move = (m: globalThis.PointerEvent) => {
      if (!dragging && Math.abs(m.clientX - start) < DRAG_PX) return;
      if (!dragging) {
        dragging = true;
        target.setPointerCapture(m.pointerId);
        onDrag?.();
      }
      const dt = Math.max(1, m.timeStamp - last.t);
      speed = speed * 0.5 + ((m.clientX - last.x) / dt) * 0.5;
      el.scrollLeft += (m.clientX - last.x) * by();
      last = { x: m.clientX, t: m.timeStamp };
    };
    const up = (u: globalThis.PointerEvent) => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      // A pointer that stopped before letting go flings nothing.
      if (!fling || !dragging || u.timeStamp - last.t > STILL_MS) return;
      let v = speed * by();
      let then = performance.now();
      const glide = (now: number) => {
        const dt = now - then;
        then = now;
        el.scrollLeft += v * dt;
        v *= FRICTION ** (dt / 16);
        if (Math.abs(v) > 0.02) coast.current = requestAnimationFrame(glide);
      };
      coast.current = requestAnimationFrame(glide);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };
  // A drag of the row ends in a click on whatever tile it let go over, which picks nothing.
  const swallowClick = () =>
    box.current?.addEventListener(
      'click',
      (c) => {
        c.stopPropagation();
        c.preventDefault();
      },
      { capture: true, once: true },
    );

  return (
    // Hovering anywhere on the strip plays every tile in view; a thumbnail out of view never plays.
    <div className="compose-strip-frame" {...on}>
      <div
        ref={box}
        className="compose-strip-tiles"
        onScroll={settle}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') follow(e, () => -1, { onDrag: swallowClick, fling: true });
        }}
      >
        {wraps && (
          <ul className="compose-strip-set" aria-hidden="true">
            {items(true, live)}
          </ul>
        )}
        <ul ref={main} className="compose-strip-set" aria-label={label}>
          {items(false, live)}
        </ul>
        {wraps && (
          <ul className="compose-strip-set" aria-hidden="true">
            {items(true, live)}
          </ul>
        )}
      </div>
      {bar.size < 1 && (
        <div
          className="compose-strip-bar"
          aria-hidden="true"
          // The thumb's place and length are the scroll position's; nothing else varies.
          style={{ '--at': bar.at, '--size': bar.size } as CSSProperties}
          onPointerDown={(e) => {
            e.stopPropagation();
            follow(e, () => {
              const el = box.current;
              return el ? (wraps ? period() : el.scrollWidth) / el.clientWidth : 1;
            });
          }}
        />
      )}
    </div>
  );
}

/** A tile, still until `live`; a `copy` drawn for the wrap is skipped by the keyboard and a reader. */
function StripTile({
  tile,
  message,
  copy,
  live,
}: {
  tile: EffectTile;
  message: Message;
  copy: boolean;
  live: boolean;
}) {
  return (
    <button
      type="button"
      className="compose-strip-tile"
      title={`Play ${tile.name} on the scene you are editing.${tile.about ? ` ${tile.about}` : ''}`}
      tabIndex={copy ? -1 : undefined}
      onClick={() => playEffect(tile.name)}
    >
      <Thumbnail
        effect={tile.name}
        effects={tile.effects}
        text={message.text}
        face={message.face}
        hex={message.hex}
        cols={COLS}
        still="action"
        playing={live}
        rewind
      />
      <span className="compose-strip-name">{effectTitle(tile.name)}</span>
    </button>
  );
}
