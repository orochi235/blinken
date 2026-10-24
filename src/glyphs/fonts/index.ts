import { tableFace } from '../table.js';
import { BYTESIZED } from './bytesized.js';
import { GALMURI7 } from './galmuri7.js';
import { GGBOT_SANS } from './ggbot-sans.js';
import { GGBOT_SLAB } from './ggbot-slab.js';
import { GGBOT_SQUARE } from './ggbot-square.js';
import { KENNEY_BLOCKS } from './kenney-blocks.js';
import { KENNEY_MINI } from './kenney-mini.js';
import { KENNEY_MINI_SQUARE } from './kenney-mini-square.js';
import { KENNEY_PIXEL } from './kenney-pixel.js';
import { KENNEY_ROCKET } from './kenney-rocket.js';
import { KENNEY_ROCKET_SQUARE } from './kenney-rocket-square.js';
import { M3X6 } from './m3x6.js';
import { M5X7 } from './m5x7.js';
import { MICRO_5 } from './micro-5.js';
import { MONOGRAM_ITALIC } from './monogram-italic.js';
import { NOTJAM_CASUAL } from './notjam-casual.js';
import { NOTJAM_CHUNKY } from './notjam-chunky.js';
import { NOTJAM_CHUNKY_SANS } from './notjam-chunky-sans.js';
import { NOTJAM_CROOKED } from './notjam-crooked.js';
import { NOTJAM_MANUSCRIPT } from './notjam-manuscript.js';
import { NOTJAM_OLD_PECULIAR } from './notjam-old-peculiar.js';
import { NOTJAM_PROPHET } from './notjam-prophet.js';
import { NOTJAM_SERIF } from './notjam-serif.js';
import { ORG_01 } from './org-01.js';
import { PUBLIC_PIXEL } from './public-pixel.js';
import { RASTER_FORGE } from './raster-forge.js';
import { SCIENTIFICA_ITALIC } from './scientifica-italic.js';
import { SILKSCREEN } from './silkscreen.js';
import { SPLEEN } from './spleen.js';
import { TINY5 } from './tiny5.js';
import { TOM_THUMB } from './tom-thumb.js';
import { UNDEAD_PIXEL } from './undead-pixel.js';

/** Faces converted from published pixel fonts; each module's header names its source and license. */
export const IMPORTED = {
  'tom-thumb': tableFace('tom-thumb', 'Tiny 3 \u00d7 5 capitals.', TOM_THUMB),
  bytesized: tableFace('bytesized', 'Crude 3 \u00d7 4 micro capitals.', BYTESIZED),
  'micro-5': tableFace('micro-5', 'Condensed 5-row capitals, proportional.', MICRO_5),
  tiny5: tableFace('tiny5', 'Rounded 4 \u00d7 5 sans.', TINY5),
  silkscreen: tableFace('silkscreen', 'Classic square 5-row UI letters.', SILKSCREEN),
  'raster-forge': tableFace('raster-forge', 'Bold 5-row letters with 2-dot stems.', RASTER_FORGE),
  'ggbot-square': tableFace('ggbot-square', 'Square, wide 5 \u00d7 5 letters.', GGBOT_SQUARE),
  'org-01': tableFace('org-01', 'Square, futuristic 5 \u00d7 5 letters.', ORG_01),
  'kenney-rocket': tableFace(
    'kenney-rocket',
    'Extended, futuristic 7-row letters with round corners.',
    KENNEY_ROCKET,
  ),
  'kenney-rocket-square': tableFace(
    'kenney-rocket-square',
    'Extended, futuristic 7-row letters with square corners.',
    KENNEY_ROCKET_SQUARE,
  ),
  'kenney-mini': tableFace('kenney-mini', 'Rounded 4 \u00d7 5 letters.', KENNEY_MINI),
  'kenney-mini-square': tableFace(
    'kenney-mini-square',
    'Square 4 \u00d7 5 letters.',
    KENNEY_MINI_SQUARE,
  ),
  'notjam-chunky-sans': tableFace('notjam-chunky-sans', 'Heavy 5-row sans.', NOTJAM_CHUNKY_SANS),
  'undead-pixel': tableFace('undead-pixel', 'Soft, rounded 6-row letters.', UNDEAD_PIXEL),
  m3x6: tableFace('m3x6', 'Condensed 3 \u00d7 6 game-UI letters.', M3X6),
  'notjam-chunky': tableFace(
    'notjam-chunky',
    'Ultra-black 6-row letters with 3-dot stems.',
    NOTJAM_CHUNKY,
  ),
  'ggbot-slab': tableFace('ggbot-slab', 'Slab-serif 7-row letters.', GGBOT_SLAB),
  'notjam-serif': tableFace('notjam-serif', 'Bold, wide Roman serif.', NOTJAM_SERIF),
  'monogram-italic': tableFace('monogram-italic', 'A true italic, 5 \u00d7 7.', MONOGRAM_ITALIC),
  'scientifica-italic': tableFace(
    'scientifica-italic',
    'Narrow italic, 4 \u00d7 7.',
    SCIENTIFICA_ITALIC,
  ),
  'notjam-manuscript': tableFace(
    'notjam-manuscript',
    'Calligraphic, handwritten capitals.',
    NOTJAM_MANUSCRIPT,
  ),
  'notjam-old-peculiar': tableFace(
    'notjam-old-peculiar',
    'Heavy, blackletter-like capitals.',
    NOTJAM_OLD_PECULIAR,
  ),
  'notjam-prophet': tableFace('notjam-prophet', 'Bold capitals with flared ends.', NOTJAM_PROPHET),
  'notjam-casual': tableFace('notjam-casual', 'Thin, casual handwriting.', NOTJAM_CASUAL),
  'notjam-crooked': tableFace('notjam-crooked', 'Wobbly, bold handwriting.', NOTJAM_CROOKED),
  'kenney-blocks': tableFace('kenney-blocks', 'Letters cut out of solid blocks.', KENNEY_BLOCKS),
  'public-pixel': tableFace('public-pixel', 'Bold, extended 7-row letters.', PUBLIC_PIXEL),
  m5x7: tableFace('m5x7', 'Plain 5 \u00d7 7 game-UI letters.', M5X7),
  'ggbot-sans': tableFace('ggbot-sans', 'Plain, even 7-row sans.', GGBOT_SANS),
  galmuri7: tableFace('galmuri7', 'Neat 5 \u00d7 7 sans.', GALMURI7),
  'kenney-pixel': tableFace('kenney-pixel', 'Plain 7-row letters.', KENNEY_PIXEL),
  spleen: tableFace('spleen', 'Terminal 5 \u00d7 6 letters.', SPLEEN),
};
