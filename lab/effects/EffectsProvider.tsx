import type { ReactNode } from 'react';
import { DesignerProvider } from '../compose/designer/DesignerProvider.js';
import type { Designer } from '../compose/designer/open.js';
import { type Preview, PreviewContext } from './preview.js';

/** Gives the effects page's components `designer`, its library and `preview` in place of the page's. */
export function EffectsProvider({
  designer,
  preview,
  children,
}: {
  designer: Designer;
  preview: Preview;
  children: ReactNode;
}) {
  return (
    <DesignerProvider designer={designer}>
      <PreviewContext.Provider value={preview}>{children}</PreviewContext.Provider>
    </DesignerProvider>
  );
}
