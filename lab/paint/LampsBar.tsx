import { usePaintStore } from './context.js';
import type { LampSettings } from './model.js';
import { Slider } from './Slider.js';

/** Every light's size, spacing, brightness and glow at once. */
export function LampsBar({ lamps }: { lamps: LampSettings }) {
  const paint = usePaintStore();
  const set = (change: Partial<LampSettings>) => paint.setLamps({ ...lamps, ...change });
  return (
    <div className="paint-row">
      <Slider
        label="LED size"
        title="Each light's diameter, in pixels (scaled to the page while fit is on)."
        min={2}
        max={40}
        step={1}
        value={lamps.size}
        onChange={(size) => set({ size })}
      />
      <Slider
        label="spacing"
        title="The gap between neighboring lights, in pixels (scaled to the page while fit is on)."
        min={0}
        max={30}
        step={1}
        value={lamps.gap}
        onChange={(gap) => set({ gap })}
      />
      <label
        className="paint-slider"
        title="Scale the board to fill the page, keeping size to spacing."
      >
        <input
          type="checkbox"
          checked={lamps.fit}
          onChange={(e) => set({ fit: e.currentTarget.checked })}
        />
        fit
      </label>
      <Slider
        label="brightness"
        title="How brightly every light shows."
        min={0.1}
        max={2}
        step={0.05}
        value={lamps.brightness}
        digits={2}
        onChange={(brightness) => set({ brightness })}
      />
      <Slider
        label="glow"
        title="How far every light blooms; 0 is none."
        min={0}
        max={3}
        step={0.05}
        value={lamps.glow}
        digits={2}
        onChange={(glow) => set({ glow })}
      />
    </div>
  );
}
