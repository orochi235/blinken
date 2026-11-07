import { CHOICES, type Choice } from '@lab/backend.js';
import { carried, carrier, type Player } from '@lab/compose/player.js';
import { Sign } from '@lab/compose/Sign.js';
import { HARDWARE, type Hardware } from '@lab/compose/sign-hardware.js';
import { NO_EFFECTS } from '@lab/compose/Thumbnail.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useEffect, useMemo, useState } from 'react';
import { AMBER, EFFECTS, type Marquee, type Scene } from '@/index.js';
import './stories.css';
import './lab-stories.css';

/** A player over whatever sign it is attached to, as the effects page's preview is. */
export type SignPlayer = Player & { attach(next: Marquee | null): void };

/** A player of the story's own, for a component that drives a sign rather than drawing one. */
export function useSignPlayer(): SignPlayer {
  const [player] = useState<SignPlayer>(() => {
    const c = carried();
    return {
      ...carrier(c),
      restart() {
        c.held = false;
        c.sign?.restart(0);
      },
    };
  });
  return player;
}

/** Two scenes, so a pass has somewhere to scrub across. */
export const PROGRAM: readonly Scene[] = [
  { effect: 'scroll', text: 'HELLO', hex: AMBER },
  { effect: 'flip', text: 'WORLD', hex: 0x3ae8ff },
];

const effects = () => NO_EFFECTS;

/** The lab's sign playing `program`, attached to `player`; a new program plays from its start. */
export function StorySign({
  player,
  program = PROGRAM,
  hardware = HARDWARE,
  choice,
}: {
  player: SignPlayer;
  program?: readonly Scene[];
  hardware?: Hardware;
  choice?: Choice;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the sign reads the program each pass; a new one only needs the pass started again.
  useEffect(() => player.restart(), [player, program]);
  return (
    <Sign
      hardware={hardware}
      program={() => program}
      effects={effects}
      onSign={player.attach}
      choice={choice}
    />
  );
}

interface SignArgs {
  text: string;
  effect: string;
  color: string;
  cols: number;
  rows: number;
  choice: Choice;
}

/** A sign built from the lab's hardware, looping one message. */
function SignStory({ text, effect, color, cols, rows, choice }: SignArgs) {
  const player = useSignPlayer();
  const program = useMemo(
    () => [{ effect, text: text || ' ', hex: Number.parseInt(color.slice(1), 16) }],
    [text, effect, color],
  );
  const hardware = useMemo(
    () => ({ ...HARDWARE, size: { ...HARDWARE.size, cols, rows } }),
    [cols, rows],
  );
  return (
    <div className="lab-story-wide">
      <StorySign player={player} program={program} hardware={hardware} choice={choice} />
    </div>
  );
}

const meta: Meta<typeof SignStory> = {
  title: 'lab/compose/Sign',
  component: SignStory,
  excludeStories: ['useSignPlayer', 'PROGRAM', 'StorySign'],
  args: { text: 'HELLO', effect: 'scroll', color: '#ffb020', cols: 60, rows: 9, choice: 'auto' },
  argTypes: {
    effect: { control: 'select', options: Object.keys(EFFECTS) },
    color: { control: 'color' },
    cols: { control: { type: 'range', min: 10, max: 160, step: 1 } },
    rows: { control: { type: 'range', min: 5, max: 24, step: 1 } },
    choice: { control: 'select', options: [...CHOICES] },
  },
};
export default meta;
type Story = StoryObj<typeof SignStory>;

export const Scroll: Story = {};
export const Flat: Story = { args: { choice: '2d', effect: 'flip', text: 'FLAT' } };
