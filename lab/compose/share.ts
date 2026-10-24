import { LAYERS, type LayerName, MODULATORS } from '@/index.js';
import { AMBER, demo } from '../demo.js';
import { pack, type ShareData, unpack } from './codec.js';
import { effectOf, entriesOf, isObj, paramsOf, sceneOf } from './readers.js';
import type { ComposeState } from './state.js';

/** A fresh composition: no designed effects, no layers on, and the demo page's program. */
export const defaultState = (): ComposeState => ({
  effects: {},
  program: demo('HELLO FROM BLITS', AMBER),
  layers: {},
  editing: { scene: 0 },
});

/** What a link carries: the composition, without what is open. */
export const shareOf = (state: ComposeState): ShareData => ({
  effects: state.effects,
  program: state.program,
  layers: Object.fromEntries(
    Object.entries(state.layers).map(([name, { on, params }]) => [
      name,
      params ? { on, params } : { on },
    ]),
  ),
});

/**
 * Only what the player plays: the effects the program names, numbered rather than named and with
 * no about, and the layers that are on.
 */
export function playable(state: ComposeState): ComposeState {
  const used = [...new Set(state.program.map((s) => s.effect as string))].filter((name) =>
    Object.hasOwn(state.effects, name),
  );
  const renamed = new Map(used.map((name, i) => [name, String(i + 1)]));
  return {
    effects: Object.fromEntries(
      used.map((name) => {
        const { about: _, ...spec } = state.effects[name] as ComposeState['effects'][string];
        const to = renamed.get(name) as string;
        return [to, { ...spec, name: to }];
      }),
    ),
    program: state.program.map((s) => {
      const to = renamed.get(s.effect as string);
      return to ? { ...s, effect: to } : s;
    }),
    layers: Object.fromEntries(Object.entries(state.layers).filter(([, l]) => l.on)),
    editing: {},
  };
}

const toBase64url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** The composition packed for the URL hash. */
export const encode = (state: ComposeState): string => toBase64url(pack(shareOf(state)));

/** What a link held: the composition, what of it was left out, and whether it read at all. */
export interface Decoded {
  state: ComposeState;
  dropped: string[];
  read: boolean;
}

/** A composition read from untrusted JSON, with everything it couldn't use named in `dropped`. */
function parse(data: unknown): Decoded {
  const dropped: string[] = [];
  const state = defaultState();
  if (!isObj(data)) return { state, dropped: [], read: false };
  state.effects = {};
  for (const [name, v] of entriesOf(data.effects, 'the effects', dropped)) {
    const spec = effectOf(name, v, dropped);
    if (spec) state.effects[name] = spec;
  }
  if (Array.isArray(data.program))
    state.program = data.program.flatMap((v) => sceneOf(v, state.effects, dropped) ?? []);
  else {
    state.program = [];
    dropped.push('the program');
  }
  for (const [name, v] of entriesOf(data.layers, 'the layers', dropped)) {
    if (!Object.hasOwn(LAYERS, name) || !isObj(v)) {
      dropped.push(`layer ${name}`);
      continue;
    }
    const base = LAYERS[name as LayerName];
    const given = paramsOf(MODULATORS[base.mod], v.params, `layer ${name}`, dropped);
    const params = { ...base.params, ...given };
    state.layers[name] = {
      ...base,
      ...(Object.keys(params).length && { params }),
      on: v.on === true,
    };
  }
  return { state, dropped, read: true };
}

/** A link written before links were packed: base64url JSON, which always opens `ey` for `{"`. */
const JSON_LINK = /^ey/;

/**
 * A composition from a URL hash; anything unknown is left out and named, never thrown. `read` is
 * false when the hash is no composition at all, and `state` is then the default.
 */
export function decode(hash: string): Decoded {
  const text = hash.replace(/^#/, '');
  if (!text) return { state: defaultState(), dropped: [], read: false };
  try {
    const bytes = fromBase64url(text);
    return parse(
      JSON_LINK.test(text)
        ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        : unpack(bytes),
    );
  } catch {
    return { state: defaultState(), dropped: [], read: false };
  }
}

export { toCode } from './code.js';
