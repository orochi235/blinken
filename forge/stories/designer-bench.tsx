import { createDesigner } from '@lab/compose/designer/open.js';
import { SIGN_RECORDS } from '@lab/compose/hardware.js';
import { createLibrary, type Library } from '@lab/compose/library.js';
import { EffectsProvider } from '@lab/effects/EffectsProvider.js';
import { createPreview } from '@lab/effects/preview.js';
import { createMemoryAdapter, Persistence } from '@weasel-js/labkit';
import { type ReactNode, useState } from 'react';
import { EFFECTS } from '@/index.js';

/** A library of two effects, so a story has something of its own to open and list. */
export const SAMPLE: Library = {
  'my fall': { ...EFFECTS.fall, name: 'my fall', about: 'The built-in fall, kept in the library.' },
  'neon bounce': { ...EFFECTS.bounce, name: 'neon bounce', active: [{ mod: 'neon' }] },
};

export interface BenchArgs {
  open: string;
  text: string;
}

/** The story's `open` choices: nothing, the sample library's, and a built-in. */
export const OPEN_OPTIONS = ['', ...Object.keys(SAMPLE), 'scroll'];

/**
 * `children` with a designer, library and preview of their own, seeded from `SAMPLE`, so nothing
 * reaches the page's saved library, its records or the URL. Changing `open` or `text` starts afresh.
 */
export function Bench({ open, text, children }: BenchArgs & { children: ReactNode }) {
  return (
    <Fresh key={`${open}\n${text}`} open={open} text={text}>
      {children}
    </Fresh>
  );
}

function Fresh({ open, text, children }: BenchArgs & { children: ReactNode }) {
  const [bench] = useState(() => {
    const designer = createDesigner({
      library: createLibrary({ effects: SAMPLE }),
      open: open || undefined,
      text,
    });
    return { designer, preview: createPreview(designer), storage: createMemoryAdapter() };
  });
  return (
    <Persistence storageKey={SIGN_RECORDS} storage={bench.storage}>
      <EffectsProvider designer={bench.designer} preview={bench.preview}>
        {children}
      </EffectsProvider>
    </Persistence>
  );
}

export const benchArgTypes = {
  open: { control: 'select', options: OPEN_OPTIONS },
  text: { control: 'text' },
} as const;
