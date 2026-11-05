import { isObj } from '../lab/compose/readers.js';
import { type Decoded, decode, fromJson } from '../lab/compose/share.js';
import { type Hardware, hardwareOf } from '../lab/compose/sign-hardware.js';

/**
 * Where a player's program and hardware come from, each overriding the last: what was compiled in,
 * a `<script type="application/json">` inside it, then its attributes.
 */
export interface Source {
  /** A share link, or the part after its `#`, or a composition file's text. */
  program?: string | null;
  /** Hardware by group, as the compose page's hardware panel sets it: `{ size: { cols: 40 } }`. */
  hardware?: unknown;
}

/** The attributes a player reads; `cols`, `rows`, `grid` and `bulbs` are short for `hardware` entries. */
export const ATTRIBUTES = ['program', 'hardware', 'cols', 'rows', 'grid', 'bulbs'] as const;

/** A program from a link, the part after a link's `#`, or a composition file's text. */
export function programOf(text: string): Decoded {
  const t = text.trim();
  return t.startsWith('{') ? fromJson(t) : decode(t.slice(t.indexOf('#') + 1));
}

/** The hardware a composition file carries beside its program, if it is one and carries any. */
function fileHardware(text: string | null | undefined): unknown {
  if (!text?.trim().startsWith('{')) return undefined;
  try {
    return (JSON.parse(text) as { hardware?: unknown }).hardware;
  } catch {
    return undefined;
  }
}

/** `text` as JSON, or nothing when it isn't. */
function json(text: string | null): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A source from a player's attributes, `get` reading one by name. */
export function attributeSource(get: (name: string) => string | null): Source {
  const num = (name: string) => {
    const v = get(name);
    return v === null || v.trim() === '' ? undefined : Number(v);
  };
  const short = {
    size: { cols: num('cols'), rows: num('rows'), grid: get('grid') ?? undefined },
    border: { bulbs: get('bulbs') ?? undefined },
  };
  return { program: get('program'), hardware: [json(get('hardware')), short] };
}

/** A source from the JSON inside a player: a composition file, with `hardware` beside it if wanted. */
export const childSource = (text: string | null | undefined): Source =>
  text?.trim() ? { program: text } : {};

/** Every group's entries from `layers` in turn, later ones winning, entries left undefined skipped. */
function merged(layers: unknown[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const add = (h: unknown) => {
    if (Array.isArray(h)) for (const each of h) add(each);
    else if (isObj(h))
      for (const [g, v] of Object.entries(h))
        if (isObj(v))
          out[g] = {
            ...out[g],
            ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)),
          };
  };
  for (const layer of layers) add(layer);
  return out;
}

/** What a player plays: its program from the last source naming one, its hardware from them all. */
export function resolve(sources: readonly Source[]): {
  decoded: Decoded | null;
  hardware: Hardware;
} {
  const text = sources.reduce<string | null>((t, s) => s.program?.trim() || t, null);
  const layers = sources.flatMap((s) => [fileHardware(s.program), s.hardware]);
  return {
    decoded: text ? programOf(text) : null,
    hardware: hardwareOf(merged(layers)),
  };
}
