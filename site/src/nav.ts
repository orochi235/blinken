/** The concepts in reading order. Each is a page at `/<slug>/` and files the exports it owns. */
export const words = [
  { slug: 'sign', title: 'Sign' },
  { slug: 'program', title: 'Program' },
  { slug: 'effect', title: 'Effects' },
  { slug: 'pieces', title: 'Pieces' },
  { slug: 'layers', title: 'Layers' },
  { slug: 'text', title: 'Faces and styles' },
  { slug: 'grids', title: 'Grids' },
  { slug: 'hardware', title: 'Broken lights' },
  { slug: 'readouts', title: 'Readouts' },
  { slug: 'thumbnails', title: 'Thumbnails' },
  { slug: 'mix', title: 'On your own mix' },
  { slug: 'player', title: 'Player' },
] as const;

export type Word = (typeof words)[number]['slug'];

/** The pages for someone starting out, above the concepts. */
export const start = [
  { slug: 'start', title: 'Get started' },
  { slug: 'gallery', title: 'Gallery' },
] as const;

interface Entry {
  slug: string;
  title: string;
  /** A page outside the site, as the lab's, linked instead of `/<slug>/`. */
  href?: string;
}

export const extra: readonly Entry[] = [
  { slug: 'reference', title: 'Reference' },
  { slug: 'changelog', title: 'Changelog' },
  { slug: 'lab', title: 'Lab', href: 'compose.html' },
];

/** The pages listed under a page in `start`, each at `/<parent>/<slug>/`. */
export const under: Record<string, readonly Entry[]> = {};

/** Every page in the order prev and next walk: the rail top to bottom. */
export const reading: readonly Entry[] = [...start, ...words, ...extra.filter((e) => !e.href)];
