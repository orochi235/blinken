import { useEffect, useState } from 'react';

/** Whether the window has focus: a page behind another app stops playing, as one scrolled away does. */
export function useFocused(): boolean {
  const [on, setOn] = useState(() => typeof document === 'undefined' || document.hasFocus());
  useEffect(() => {
    const focus = () => setOn(true);
    const blur = () => setOn(false);
    window.addEventListener('focus', focus);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('focus', focus);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return on;
}
