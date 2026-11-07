import { PaintProvider, usePaint } from '@lab/paint/context.js';
import { createPaintStore } from '@lab/paint/store.js';
import { TextBar } from '@lab/paint/TextBar.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { LabRoot } from '@weasel-js/labkit';
import { useMemo } from 'react';
import type { FaceName } from '@/index.js';
import '@lab/paint/App.css';
import './paint-stories.css';
import './stories.css';

interface TextArgs {
  picked: boolean;
  text: string;
  face: FaceName;
}

const LAYOUT = { cols: 48, rows: 16, grid: 'square' as const };

function Bar() {
  const { layout, picture, stamps, picked } = usePaint();
  return (
    <div className="forge-stack">
      <TextBar
        picked={stamps.find((s) => s.id === picked) ?? null}
        layout={layout}
        hex={0xff4040}
        level={1}
      />
      <output className="forge-value">
        {stamps
          .map((s) => `${s.id === picked ? '*' : ' '} ${s.face} ${JSON.stringify(s.text)}`)
          .join('\n') || 'no text on the board'}
        {`\n${Object.keys(picture).length} dots painted`}
      </output>
    </div>
  );
}

/** The paint page's text tool, on a store of its own holding one stamp, picked up or not. */
function TextBarStory({ picked, text, face }: TextArgs) {
  const store = useMemo(() => {
    const s = createPaintStore({
      seed: {
        layout: LAYOUT,
        stamps: [{ id: 'story', text, face, x: 1, y: 1, hex: 0x40e0d0, level: 1 }],
      },
    });
    if (picked) s.pick('story');
    return s;
  }, [picked, text, face]);
  return (
    <LabRoot mode="dark" className="story-lab">
      <PaintProvider value={store}>
        <Bar />
      </PaintProvider>
    </LabRoot>
  );
}

const meta: Meta<typeof TextBarStory> = {
  title: 'lab/paint/TextBar',
  component: TextBarStory,
  args: { picked: true, text: 'GATE 12', face: 'standard' },
};
export default meta;
type Story = StoryObj<typeof TextBarStory>;

export const Picked: Story = {};
export const NextStamp: Story = { args: { picked: false } };
