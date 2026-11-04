import { mix, patch } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { signColumns } from '@/draw.js';
import { attach, pullChannels } from '@/render/attach.js';

const b = board(10, 7);
const ON = patch<Subject, Pose>(1000, () => ({ lit: 1, gain: 0.5 }), { writes: ['lit', 'gain'] });

describe('pullChannels', () => {
  it('pulls only the channels asked for, and paints the bulbs just those', () => {
    const m = mix<Subject, Pose>(KIT);
    m.cue({ patch: ON, subjects: [...b.dots, ...b.cells], loop: true });
    m.sync(0);
    m.sync(10);
    const cols = signColumns(b.dots.length + b.bulbs.length);
    const cells = signColumns(b.cells.length);
    pullChannels(m, b, cols, cells, new Set(['lit']));
    expect(cols.lit.every((v) => v === 1)).toBe(true);
    expect(cols.gain.every((v) => v === 1)).toBe(true);
    expect(cells.gain.every((v) => v === 1)).toBe(true);
    pullChannels(
      m,
      b,
      cols,
      cells,
      new Set(['lit', 'gain', 'tint', 'hue', 'chroma', 'glow', 'invert']),
    );
    expect(cols.gain.every((v) => v === 0.5)).toBe(true);
  });
});

describe('attach', () => {
  it('draws nothing, with every channel on the CPU, when not drawing', () => {
    const d = attach({} as HTMLCanvasElement, b, [...b.dots, ...b.bulbs], {
      draw: false,
      backend: undefined,
      gpu: undefined,
      backed: true,
      grid: (x, y) => [x, y],
    });
    expect(d.backend).toBe('2d');
    expect(d.sign).toBeNull();
    expect(d.engine).toBeUndefined();
    expect(d.cpuChannels().size).toBe(7);
  });
});
