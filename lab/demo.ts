import { AMBER, type Scene } from '@/index.js';

export const RED = 0xff4030;
export const GREEN = 0x6dff5a;

/** The demo page's program, with `message` in `hex` where the visitor's own text goes. */
export const demo = (message: string, hex: number): Scene[] => [
  { effect: 'hold', text: 'BLITS', hex: AMBER },
  { effect: 'scroll', text: message, hex },
  { effect: 'flip', text: 'NOW SHOWING', hex: RED },
  { effect: 'tile', text: message, hex },
  { effect: 'roll', text: 'JACKPOT', hex: GREEN },
  {
    effect: 'scroll',
    text: 'CONCURRENT EFFECTS, FOLDED INTO ONE VALUE PER DOT PER FRAME',
    hex: GREEN,
  },
  { effect: 'fall', text: 'TONIGHT!', hex: AMBER },
  { effect: 'matris', text: 'WAKE UP', hex: GREEN },
];
