import { describe, expect, it } from 'vitest';
import { board } from '@/board.js';
import { afflict, afflictions, scatter } from '@/defects.js';

const b = board(10, 7);
const leds = [...b.dots, ...b.bulbs];
const dot = (x: number, y: number) => y * b.cols + x;

describe('afflict', () => {
  it('leaves a sound light as the mix asks', () => {
    const a = afflictions(leds, []);
    expect(afflict(a, 0, 0.7, 0)).toBe(0.7);
  });

  it('never lights a dead dot, and dims a dim one', () => {
    const a = afflictions(leds, [
      { kind: 'dead', at: { x: 1, y: 2 } },
      { kind: 'dim', at: { x: 3, y: 0 }, gain: 0.25 },
    ]);
    expect(afflict(a, dot(1, 2), 1, 0)).toBe(0);
    expect(afflict(a, dot(3, 0), 1, 0)).toBe(0.25);
  });

  it('keeps a stuck light lit when the mix asks for dark', () => {
    const a = afflictions(leds, [{ kind: 'stuck', at: { bulb: 2 }, level: 0.8 }]);
    const i = b.dots.length + 2;
    expect(afflict(a, i, 0, 0)).toBe(0.8);
    expect(afflict(a, i, 1, 0)).toBe(1);
  });

  it('drops a flickering light out for about the share its duty leaves', () => {
    const a = afflictions(leds, [{ kind: 'flicker', at: { x: 0, y: 0 }, rate: 10, duty: 0.5 }]);
    let lit = 0;
    for (let k = 0; k < 2000; k++) if (afflict(a, 0, 1, k * 100) > 0) lit++;
    expect(lit / 2000).toBeGreaterThan(0.4);
    expect(lit / 2000).toBeLessThan(0.6);
  });

  it('lets a later defect on a light replace an earlier one', () => {
    const a = afflictions(leds, [
      { kind: 'dead', at: { x: 0, y: 0 } },
      { kind: 'dim', at: { x: 0, y: 0 }, gain: 0.5 },
    ]);
    expect(afflict(a, 0, 1, 0)).toBe(0.5);
  });

  it('leaves out a defect naming no light', () => {
    const a = afflictions(leds, [{ kind: 'dead', at: { x: 99, y: 0 } }]);
    expect([...a.scale].every((s) => s === 1)).toBe(true);
  });
});

describe('scatter', () => {
  const big = board(80, 21);

  it('breaks about each share of the dots, never one dot twice', () => {
    const d = scatter(big, { dead: 0.05, dim: 0.1 }, 3);
    const dead = d.filter((x) => x.kind === 'dead').length / big.dots.length;
    const dim = d.filter((x) => x.kind === 'dim').length / big.dots.length;
    expect(dead).toBeGreaterThan(0.03);
    expect(dead).toBeLessThan(0.07);
    expect(dim).toBeGreaterThan(0.07);
    expect(dim).toBeLessThan(0.13);
    const at = new Set(d.map((x) => ('x' in x.at ? `${x.at.x},${x.at.y}` : '')));
    expect(at.size).toBe(d.length);
  });

  it('breaks the same dots for the same seed, and others for another', () => {
    expect(scatter(big, { dead: 0.05 }, 3)).toEqual(scatter(big, { dead: 0.05 }, 3));
    expect(scatter(big, { dead: 0.05 }, 4)).not.toEqual(scatter(big, { dead: 0.05 }, 3));
  });

  it('breaks nothing with no shares', () => {
    expect(scatter(big, {})).toEqual([]);
  });
});
