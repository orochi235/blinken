import { describe, expect, it } from 'vitest';
import type { EffectSpec } from '@/index.js';
import { graphOf, idOf, partOf, viewFor } from '../lab/compose/designer/graph.js';

const fall: EffectSpec = {
  name: 'fall',
  enter: { move: 'drop-in' },
  active: [{ move: 'stand' }, { mod: 'flare' }],
  exit: { move: 'drop-out' },
  hold: 1700,
};
const parts = {
  enter: { start: 0, ms: 350 },
  active: { start: 350, ms: 1700 },
  exit: { start: 2050, ms: 350 },
};
const ids = (xs: readonly { id?: string }[]) => xs.map((x) => x.id);

describe('the effect graph', () => {
  it('round-trips its ids', () => {
    for (const part of [
      { kind: 'piece', slot: 'active', index: 1 },
      { kind: 'step', slot: 'exit' },
      { kind: 'channel', channel: 'glow' },
      { kind: 'sign' },
    ] as const)
      expect(partOf(idOf(part))).toEqual(part);
    expect(partOf('nonsense')).toBeNull();
  });

  it('draws signal flow: pieces into the channels they write, channels into the sign', () => {
    const g = graphOf(fall, 'signal', parts);
    expect(ids(g.nodes)).toEqual([
      'piece:enter:0',
      'piece:active:0',
      'piece:active:1',
      'piece:exit:0',
      'channel:lit',
      'channel:glow',
      'sign',
    ]);
    expect(g.edges.map((e) => `${e.from}>${e.to}`)).toEqual([
      'piece:enter:0>channel:lit',
      'piece:active:0>channel:lit',
      'piece:active:1>channel:glow',
      'piece:exit:0>channel:lit',
      'channel:lit>sign',
      'channel:glow>sign',
    ]);
    expect(g.nodes[0]?.lines).toEqual(['drop-in', 'enter']);
  });

  it('draws time flow: steps in sequence with their lengths, each with its pieces', () => {
    const g = graphOf({ ...fall, blend: 120 }, 'time', parts);
    expect(g.nodes.find((n) => n.id === 'step:active')?.lines).toEqual(['active', '1.70 s']);
    const seq = g.edges.filter((e) => e.from.startsWith('step:') && e.to.startsWith('step:'));
    expect(seq.map((e) => [e.from, e.to, e.label])).toEqual([
      ['step:enter', 'step:active', 'blend 120 ms'],
      ['step:active', 'step:exit', 'blend 120 ms'],
    ]);
    expect(g.edges.some((e) => e.from === 'step:active' && e.to === 'piece:active:1')).toBe(true);
    expect(g.nodes.some((n) => n.id.startsWith('channel:'))).toBe(false);
  });

  it('draws both: steps as containers holding their pieces, wired to channels', () => {
    const g = graphOf(fall, 'both', parts);
    expect(g.containers?.map((c) => [c.id, c.members])).toEqual([
      ['step:enter', ['piece:enter:0']],
      ['step:active', ['piece:active:0', 'piece:active:1']],
      ['step:exit', ['piece:exit:0']],
    ]);
    expect(g.edges.some((e) => e.from === 'piece:active:1' && e.to === 'channel:glow')).toBe(true);
    expect(g.nodes.some((n) => n.id === 'sign' || n.id.startsWith('step:'))).toBe(false);
  });

  it('leaves lengths off when staging failed', () => {
    const g = graphOf(fall, 'time', null);
    expect(g.nodes.find((n) => n.id === 'step:enter')?.lines).toEqual(['enter']);
  });

  it('says which view suits a pick', () => {
    expect(viewFor('piece:active:1', fall)).toBe('signal');
    expect(viewFor('channel:glow', fall)).toBe('signal');
    expect(viewFor('step:active', fall)).toBe('time');
    expect(viewFor('piece:enter:0', fall)).toBeNull();
  });
});
