/** A labeled range input with its value read out after it, `digits` places past the point. */
export function Slider({
  label,
  title,
  min,
  max,
  step,
  value,
  digits = 0,
  onChange,
}: {
  label: string;
  title: string;
  min: number;
  max: number;
  step: number;
  value: number;
  digits?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="paint-slider" title={title}>
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <output className="paint-readout">{value.toFixed(digits)}</output>
    </label>
  );
}
