import { STEP_SEQUENCE, type TransitionRecipe } from '@/index.js';

/** The fields a recipe can leave out, at the values `createTransition` takes for them. */
const DEFAULTS: Partial<TransitionRecipe> = {
  order: 'left',
  spread: 0,
  easing: 'linear',
  through: STEP_SEQUENCE,
  rolls: 10,
};

/** The fields each move reads, besides name, ms, move, order, spread and easing. */
const OWN: Partial<Record<TransitionRecipe['move'], keyof TransitionRecipe>> = {
  step: 'through',
  scramble: 'rolls',
};

/** The `createTransition` call that makes `r`, its defaults and unread fields left out. */
export function codeOf(r: TransitionRecipe): string {
  const keys: (keyof TransitionRecipe)[] = ['name', 'ms', 'move', 'order', 'spread', 'easing'];
  const own = OWN[r.move];
  if (own) keys.push(own);
  const fields = keys
    .filter(
      (k) =>
        r[k] !== undefined && (k === 'name' || k === 'ms' || k === 'move' || r[k] !== DEFAULTS[k]),
    )
    .map((k) => `${k}: ${literal(r[k])}`);
  return `import { createTransition } from '@msb235/blinken';\n\nexport const ${identifier(r.name)} = createTransition({ ${fields.join(', ')} });\n`;
}

const literal = (v: unknown) =>
  typeof v === 'string' ? `'${v.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'` : String(v);

/** A JavaScript name for a transition named `name`. */
function identifier(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const camel = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0]?.toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  return /^[A-Za-z_]/.test(camel) ? camel : `t${camel}`;
}
