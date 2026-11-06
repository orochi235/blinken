/** Lite-Brite's pegs and the hues between them, a warm white, and white. */
export const PALETTE = {
  red: 0xff3030,
  orange: 0xff7a1e,
  amber: 0xffb020,
  yellow: 0xffe23a,
  lime: 0xb6ff3a,
  green: 0x4dff5a,
  mint: 0x3affb0,
  cyan: 0x3ae8ff,
  sky: 0x3ab4ff,
  blue: 0x3a6cff,
  indigo: 0x6a4aff,
  violet: 0xb05aff,
  magenta: 0xff3aff,
  pink: 0xff5ac8,
  warm: 0xffd8a0,
  white: 0xffffff,
} as const;

/**
 * A color menu (each readout's own, the palette by name, or custom) with its swatch: picking in the
 * swatch switches the menu to custom. Calls `changed` on each pick, the swatch's as it's
 * dragged; gives the color picked, undefined for each readout's own.
 */
export function colorPicker(
  menu: HTMLSelectElement,
  swatch: HTMLInputElement,
  changed: () => void,
): () => number | undefined {
  for (const name of ['own', ...Object.keys(PALETTE), 'custom']) menu.add(new Option(name));
  menu.addEventListener('change', changed);
  swatch.addEventListener('input', () => {
    menu.value = 'custom';
    changed();
  });
  return () => {
    const name = menu.value;
    if (name === 'own') return undefined;
    if (name === 'custom') return Number.parseInt(swatch.value.slice(1), 16);
    return PALETTE[name as keyof typeof PALETTE];
  };
}
