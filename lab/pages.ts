import type { LabShellProps } from '@weasel-js/labkit';

/** The lab's pages, which each page's title offers as a switcher. */
export const PAGES: NonNullable<LabShellProps['pages']> = [
  { href: 'play.html', label: 'play' },
  { href: 'compose.html', label: 'compose' },
  { href: 'effects.html', label: 'effects' },
  { href: 'paint.html', label: 'paint' },
  { href: 'readouts.html', label: 'readouts' },
  { href: 'inputs.html', label: 'inputs' },
  { href: 'transitions.html', label: 'transitions' },
];
