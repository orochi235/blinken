import type { Source } from './config.js';
import { definePlayer } from './element.js';

/** Filled in by `npm run compile`: the tag to define, and what it plays when the page says nothing. */
declare const __BREE_TAG__: string;
declare const __BREE_BAKED__: Source;

definePlayer(__BREE_TAG__, __BREE_BAKED__);
