import type { Opened } from '@lab/compose/create-store.js';
import type { Library } from '@lab/compose/library.js';
import { Sign } from '@lab/compose/Sign.js';
import { HARDWARE } from '@lab/compose/sign-hardware.js';
import type { ComposeState } from '@lab/compose/state.js';
import {
  ComposeProvider,
  createComposeStore,
  type LibrarySource,
  useChoice,
  useComposeStore,
} from '@lab/compose/store.js';
import { GREEN, RED } from '@lab/demo.js';
import type { CsfDecorator } from '@weasel-js/forge';
import { type ReactNode, useState } from 'react';
import { AMBER } from '@/index.js';
import './compose-stories.css';

/** A short program with a scene in a face, a styled one and one with a layer on, the second picked. */
export const SAMPLE: ComposeState = {
  effects: {},
  program: [
    { effect: 'hold', text: 'BLINKEN', hex: AMBER },
    { effect: 'scroll', text: 'NOW SHOWING', hex: RED, style: { outline: true } },
    { effect: 'flip', text: 'TONIGHT', hex: GREEN, face: 'bold' },
    { effect: 'roll', text: 'JACKPOT', hex: AMBER, layers: { shimmer: true } },
  ],
  editing: { scene: 1 },
};

const NO_EFFECTS: Library = {};
/** An empty library that never changes, so a story reads nothing the effects page kept. */
const NO_LIBRARY: LibrarySource = { get: () => NO_EFFECTS, subscribe: () => () => {} };

/** What a story's `parameters.compose` may set: the state it opens with, and what its link left out. */
export type StoryOpened = Partial<Opened>;

/** A store of the story's own, kept in memory: it writes nothing to browser storage or the address. */
function InStore({ opened, children }: { opened?: StoryOpened; children: ReactNode }) {
  const [store] = useState(() =>
    createComposeStore({ opened: { state: SAMPLE, ...opened }, library: NO_LIBRARY }),
  );
  return <ComposeProvider store={store}>{children}</ComposeProvider>;
}

/** Wraps a story in a fresh store seeded from `SAMPLE` and the story's `parameters.compose`. */
export const withStore: CsfDecorator = (Story, { parameters }) => (
  <InStore opened={parameters.compose as StoryOpened | undefined}>
    <Story />
  </InStore>
);

/** A frame as wide as a column of the compose page, `wide` for its middle one. */
export function Pane({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'compose-story-pane is-wide' : 'compose-story-pane'}>{children}</div>
  );
}

/** The sign the page draws, playing the story store's program, so playback has something to drive. */
export function StorySign() {
  const store = useComposeStore();
  return (
    <Sign
      hardware={HARDWARE}
      program={store.playing}
      effects={() => store.get().effects}
      onSign={store.attach}
      choice={useChoice()}
    />
  );
}
