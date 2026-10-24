import { describe, expect, it } from 'vitest';
import { freeLibraryName, library, libraryJson, parseLibrary } from '../lab/compose/library.js';

const stand = (name: string, hold = 1000) => ({ name, active: [{ move: 'stand' as const }], hold });

describe('the effects library', () => {
  it('reads back the JSON it writes, leaving out what is not an effect', () => {
    const json = libraryJson({ glow: stand('glow') });
    expect(parseLibrary(json).effects).toEqual({ glow: stand('glow') });
    const bad = parseLibrary(JSON.stringify({ effects: { ok: stand('ok'), no: 7 } }));
    expect(Object.keys(bad.effects)).toEqual(['ok']);
    expect(bad.dropped.length).toBeGreaterThan(0);
    expect(parseLibrary('not json').read).toBe(false);
  });

  it('merges an identical effect in place and a different one under a free name', () => {
    library.replace({ glow: stand('glow') });
    const named = library.merge({ glow: stand('glow'), fresh: stand('fresh') });
    expect(named).toEqual({ glow: 'glow', fresh: 'fresh' });
    const again = library.merge({ glow: stand('glow', 2000) });
    expect(again).toEqual({ glow: 'glow 2' });
    expect(library.get()['glow 2']).toEqual(stand('glow 2', 2000));
  });

  it('renames only to a name no effect or built-in holds', () => {
    library.replace({ a: stand('a'), b: stand('b') });
    expect(library.rename('a', 'b')).toBe(false);
    expect(library.rename('a', 'hold')).toBe(false);
    expect(library.rename('a', 'c')).toBe(true);
    expect(Object.keys(library.get()).sort()).toEqual(['b', 'c']);
    expect(freeLibraryName('hold')).toBe('hold 2');
  });
});
