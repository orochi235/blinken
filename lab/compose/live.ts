import { type PointerEvent, useState } from 'react';

/**
 * Whether a preview plays: while the pointer is over it or it has focus, and from a touch until
 * the next touch elsewhere, since a finger never hovers. Spread `on` over the element it covers.
 */
export function useLive() {
  const [live, setLive] = useState(false);
  const stop = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') setLive(false);
  };
  return {
    live,
    on: {
      onPointerEnter: () => setLive(true),
      onPointerLeave: stop,
      onFocus: () => setLive(true),
      onBlur: () => setLive(false),
    },
  };
}
