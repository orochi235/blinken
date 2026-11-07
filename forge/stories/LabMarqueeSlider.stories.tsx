import { marqueeSlider } from '@lab/compose/MarqueeSlider.js';
import { DENSITY, times } from '@lab/compose/schema.js';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ControlPanel, f, resolveConfigSchema } from '@weasel-js/labkit';
import { useMemo, useState } from 'react';
import type { NumberParam } from '@/index.js';
import './stories.css';
import './lab-stories.css';

interface MarqueeSliderArgs {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  scale: number;
}

/** A number's row with its value on a small dot-matrix readout, which can be typed into. */
function MarqueeSliderStory({ label, min, max, step, value, unit, scale }: MarqueeSliderArgs) {
  const param: NumberParam = useMemo(
    () => ({ label, about: 'A number to set.', min, max, step, value, unit, scale }),
    [label, min, max, step, value, unit, scale],
  );
  const renderers = useMemo(() => ({ 'story-readout': marqueeSlider(param) }), [param]);
  const schema = useMemo(
    () =>
      resolveConfigSchema(
        f.schema({
          n: f
            .custom('story-readout', times(param.value, scale))
            .label(label)
            .describe(param.about),
        }),
      ),
    [param, label, scale],
  );
  const [n, setN] = useState<unknown>(times(value, scale));
  const set = (_: string, v: unknown) => setN(v);
  return (
    <div className="forge-stack lab-story-wide">
      <ControlPanel
        density={DENSITY}
        schema={schema}
        config={{ n }}
        setConfig={set}
        draftConfig={set}
        renderers={renderers}
      />
      <output className="forge-value">{JSON.stringify(n)}</output>
    </div>
  );
}

const meta: Meta<typeof MarqueeSliderStory> = {
  title: 'lab/compose/MarqueeSlider',
  component: MarqueeSliderStory,
  args: { label: 'columns', min: 10, max: 240, step: 1, value: 80, unit: '', scale: 1 },
};
export default meta;
type Story = StoryObj<typeof MarqueeSliderStory>;

export const Dots: Story = {};
export const Percent: Story = {
  args: { label: 'ghost', min: 0, max: 0.3, step: 0.005, value: 0.05, unit: '%', scale: 100 },
};
