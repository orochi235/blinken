import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Marquee } from '@/index.js';

type Store = typeof import('../lab/compose/store.js');
let compose: Store['compose'];

beforeAll(async () => {
  const kept = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
    removeItem: (k: string) => void kept.delete(k),
  });
  vi.stubGlobal('location', { hash: '', pathname: '/compose', search: '' });
  vi.stubGlobal('history', { replaceState: () => {} });
  vi.stubGlobal('addEventListener', () => {});
  ({ compose } = await import('../lab/compose/store.js'));
});

/** A sign that records the seeks made on it, standing at `at`. */
const sign = (at: number) => {
  const seeks: [number, boolean | undefined][] = [];
  const m = {
    pass: () => ({ at, length: 10000, scenes: [] }),
    seek: (ms: number, opts?: { hold?: boolean }) => void seeks.push([ms, opts?.hold]),
    ramp: () => {},
    setEffects: () => {},
    restart: () => {},
  };
  return { m: m as unknown as Marquee, seeks };
};

/** Takes `old` down and puts up a new sign in its place, as a resize does. */
const resize = (old: ReturnType<typeof sign>) => {
  compose.attach(old.m);
  const next = sign(0);
  compose.attach(null);
  compose.attach(next.m);
  return next;
};

describe('the compose store across a resize', () => {
  it('keeps a held position held on the sign that replaces it', () => {
    const old = sign(2500);
    compose.attach(old.m);
    compose.seek(2500, true);
    expect(resize(old).seeks).toEqual([[2500, true]]);
  });

  it('plays on from where the pass stood once the hold is let go', () => {
    const old = sign(4000);
    compose.attach(old.m);
    compose.seek(4000);
    expect(resize(old).seeks).toEqual([[4000, false]]);
  });

  it('plays on after a restart, which lets go of a hold', () => {
    const old = sign(1200);
    compose.attach(old.m);
    compose.seek(1200, true);
    compose.restart();
    expect(resize(old).seeks).toEqual([[1200, false]]);
  });
});
