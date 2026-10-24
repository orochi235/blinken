import { type FocusEvent, type PointerEvent, useEffect, useRef, useState } from 'react';

/**
 * Whether a preview plays: while the pointer is over it or it has focus, and from a touch until
 * the next touch elsewhere, since a finger never hovers. Spread `on` over the element it covers.
 */
export function useLive() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const unwatch = useRef<(() => void) | null>(null);
  const touched = useRef(false);
  const leave = () => {
    unwatch.current?.();
    unwatch.current = null;
    setHovered(false);
  };
  useEffect(() => () => unwatch.current?.(), []);

  // A `pointerleave` alone goes missing: content scrolled or laid out from under a still pointer,
  // or a pointer that leaves the window fast. So while hovered, the page is watched for the end.
  const enter = (e: PointerEvent<HTMLElement>) => {
    setHovered(true);
    touched.current = e.pointerType === 'touch';
    if (touched.current || unwatch.current) return;
    const el = e.currentTarget;
    let x = e.clientX;
    let y = e.clientY;
    const outside = (n: EventTarget | null) => !el.isConnected || !el.contains(n as Node | null);
    const move = (m: globalThis.PointerEvent) => {
      x = m.clientX;
      y = m.clientY;
      if (outside(m.target)) leave();
    };
    const recheck = () => {
      if (outside(document.elementFromPoint(x, y))) leave();
    };
    const out = (o: MouseEvent) => {
      if (!o.relatedTarget) leave();
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('scroll', recheck, true);
    window.addEventListener('resize', recheck);
    document.addEventListener('mouseout', out);
    window.addEventListener('blur', leave);
    unwatch.current = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('scroll', recheck, true);
      window.removeEventListener('resize', recheck);
      document.removeEventListener('mouseout', out);
      window.removeEventListener('blur', leave);
    };
  };

  return {
    live: hovered || focused,
    on: {
      onPointerEnter: enter,
      onPointerLeave: (e: PointerEvent) => {
        if (e.pointerType !== 'touch') leave();
      },
      // A click focuses too, and that focus would outlast the pointer.
      onFocus: (e: FocusEvent) => setFocused((e.target as Element).matches(':focus-visible')),
      onBlur: () => {
        setFocused(false);
        if (touched.current) setHovered(false);
      },
    },
  };
}
