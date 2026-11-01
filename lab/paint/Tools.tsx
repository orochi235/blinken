import { Button } from '@weasel-js/labkit';
import { SHAPES, type Shape, type Tool } from './model.js';
import { Slider } from './Slider.js';

const TOOLS: { tool: Tool; about: string }[] = [
  { tool: 'paint', about: 'Light dots in the color, at the brightness. Right-drag erases.' },
  { tool: 'shade', about: 'Set lit dots to the brightness, keeping their color.' },
  { tool: 'erase', about: 'Turn dots off.' },
  { tool: 'text', about: 'Add text, then drag it where it goes.' },
];

/** The tool, and the brush's shape, size and brightness. */
export function Tools({
  tool,
  shape,
  size,
  level,
  onTool,
  onShape,
  onSize,
  onLevel,
}: {
  tool: Tool;
  shape: Shape;
  size: number;
  level: number;
  onTool: (t: Tool) => void;
  onShape: (s: Shape) => void;
  onSize: (n: number) => void;
  onLevel: (n: number) => void;
}) {
  return (
    <div className="paint-row">
      <div className="paint-group">
        {TOOLS.map(({ tool: t, about }) => (
          <Button key={t} size="sm" tooltip={about} pressed={tool === t} onClick={() => onTool(t)}>
            {t}
          </Button>
        ))}
      </div>
      <div className="paint-group">
        {SHAPES.map((s) => (
          <Button
            key={s}
            size="sm"
            tooltip={`A ${s} brush.`}
            pressed={shape === s}
            disabled={tool === 'text'}
            onClick={() => onShape(s)}
          >
            {s}
          </Button>
        ))}
      </div>
      <Slider
        label="size"
        title="How many dots across the brush reaches."
        min={1}
        max={15}
        step={1}
        value={size}
        onChange={onSize}
      />
      <Slider
        label="level"
        title="How brightly what you paint lights; the shade tool sets lit dots to it."
        min={0.05}
        max={1}
        step={0.05}
        value={level}
        digits={2}
        onChange={onLevel}
      />
    </div>
  );
}
