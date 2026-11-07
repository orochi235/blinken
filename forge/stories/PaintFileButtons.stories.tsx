import { PaintProvider, usePaint } from '@lab/paint/context.js';
import { FileButtons } from '@lab/paint/FileButtons.js';
import type { Picture } from '@lab/paint/model.js';
import { createPaintStore } from '@lab/paint/store.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { LabRoot } from '@weasel-js/labkit';
import { useMemo } from 'react';
import '@lab/paint/App.css';
import './paint-stories.css';
import './stories.css';

interface FileArgs {
  cols: number;
  rows: number;
  dots: number;
}

/** A diagonal of `n` red dots. */
const diagonal = (n: number): Picture =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [`${i},${i}`, { hex: 0xff4040, level: 1 }]),
  );

function Buttons() {
  const { layout, picture, stamps } = usePaint();
  return (
    <div className="forge-stack">
      <div className="paint-row">
        <FileButtons />
      </div>
      <output className="forge-value">
        {`${layout.cols} × ${layout.rows} ${layout.grid}, ${Object.keys(picture).length} dots, ${stamps.length} stamps`}
      </output>
    </div>
  );
}

/** The paint page's save, load and link buttons, on a store of its own holding a small picture. */
function FileButtonsStory({ cols, rows, dots }: FileArgs) {
  const store = useMemo(
    () =>
      createPaintStore({
        seed: { layout: { cols, rows, grid: 'square' }, picture: diagonal(dots) },
      }),
    [cols, rows, dots],
  );
  return (
    <LabRoot mode="dark" className="story-lab">
      <PaintProvider value={store}>
        <Buttons />
      </PaintProvider>
    </LabRoot>
  );
}

const meta: Meta<typeof FileButtonsStory> = {
  title: 'lab/paint/FileButtons',
  component: FileButtonsStory,
  args: { cols: 24, rows: 12, dots: 12 },
  argTypes: {
    cols: { control: { type: 'range', min: 4, max: 96, step: 1 } },
    rows: { control: { type: 'range', min: 4, max: 48, step: 1 } },
    dots: { control: { type: 'range', min: 0, max: 48, step: 1 } },
  },
};
export default meta;
type Story = StoryObj<typeof FileButtonsStory>;

export const Drawn: Story = {};
export const Empty: Story = { args: { dots: 0 } };
