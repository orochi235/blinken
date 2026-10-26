import { useEffect, useRef } from 'react';

/** A ref for a card's box, scrolled into view each time the card becomes the picked one. */
export function usePickedBox<T extends HTMLElement>(picked: boolean) {
  const box = useRef<T>(null);
  useEffect(() => {
    if (picked) box.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked]);
  return box;
}
