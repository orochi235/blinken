import type { Source } from './config.js';
import { definePlayer } from './element.js';

/** Filled in by `npm run compile`: the tag to define, and what it plays when the page says nothing. */
declare const __BLINKEN_TAG__: string;
declare const __BLINKEN_BAKED__: Source;

definePlayer(__BLINKEN_TAG__, __BLINKEN_BAKED__);
