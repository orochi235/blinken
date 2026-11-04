import type { LabShellProps } from '@weasel-js/labkit';

/** The lab's pages, which each page's title offers as a switcher. */
export const PAGES: NonNullable<LabShellProps['pages']> = [
  { href: 'compose.html', label: 'compose' },
  { href: 'effects.html', label: 'effects' },
  { href: 'paint.html', label: 'paint' },
  { href: 'readouts.html', label: 'readouts' },
];
