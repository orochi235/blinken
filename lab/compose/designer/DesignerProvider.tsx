import type { ReactNode } from 'react';
import { LibraryContext } from '../library.js';
import { type Designer, DesignerContext } from './open.js';

/** Gives the components under it `designer` and its library in place of the page's own. */
export function DesignerProvider({
  designer,
  children,
}: {
  designer: Designer;
  children: ReactNode;
}) {
  return (
    <DesignerContext.Provider value={designer}>
      <LibraryContext.Provider value={designer.library}>{children}</LibraryContext.Provider>
    </DesignerContext.Provider>
  );
}
