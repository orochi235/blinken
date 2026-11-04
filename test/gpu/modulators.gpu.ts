import { type Mix, mix } from '@msb235/blits';
import { gpu, gpuOf } from '@msb235/blits/gpu';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import { LAYERS, type LayerSpec } from '@/builtins.js';
import { fieldsOf } from '@/modulators/shader.js';
import { cueLayer } from '@/program.js';
import { close, note, readBack, test } from './harness.js';

const b = board(40, 7);
const all: Subject[] = [...b.dots, ...b.cells];

/** How far apart two hues are, the short way round. */
const turn = (a: number, c: number) => Math.abs(((((a - c) % 360) + 540) % 360) - 180);

/**
 * Cues `layer` on a 40 × 7 board under the gpu engine and under the CPU mixer, and checks each
 * channel it writes, read back from the GPU, against the CPU's `probe` for every subject at each
 * of `times`. Notes the largest disagreement.
 */
async function agree(
  device: Parameters<typeof gpu>[0]['device'],
  layer: LayerSpec,
  writes: readonly (keyof Pose)[],
  times: readonly number[],
  tolerance = 1e-5,
): Promise<void> {
  const make = (engine?: ReturnType<typeof gpu>) => {
    const m: Mix<Subject, Pose> = mix<Subject, Pose>(KIT, engine ? { engine } : {});
    m.sync(0);
    cueLayer(m, b, layer, 1);
    return m;
  };
  const g = make(gpu({ device }));
  const c = make();
  const side = gpuOf(g);
  side.subjects(all, fieldsOf);
  for (const w of writes) side.channel(w);
  await side.ready;
  let worst = 0;
  const seen = new Map<string, Set<number>>(writes.map((w) => [w, new Set()]));
  for (const t of times) {
    g.sync(t);
    c.sync(t);
    for (const w of writes) {
      const ch = side.channel(w);
      if (ch === null) throw new Error(`${w} is not on the GPU`);
      const got = await readBack(device, ch.buffer, ch.offset, all.length * ch.axes * 4);
      all.forEach((s, i) => {
        const want = c.probe(s)[w];
        const wants = Array.isArray(want) ? want : [want];
        for (let a = 0; a < ch.axes; a++) {
          const gv = got[i * ch.axes + a] as number;
          const cv = (wants[a] ?? 0) as number;
          const off = w === 'hue' ? turn(gv, cv) : Math.abs(gv - cv);
          worst = Math.max(worst, off);
          seen.get(w)?.add(cv);
          const what = `${w} t ${t} ${s.kind} ${'x' in s ? `${s.x},${s.y}` : s.i} axis ${a}`;
          if (w === 'hue') close(off, 0, what, tolerance);
          else close(gv, cv, what, tolerance);
        }
      });
    }
  }
  for (const [w, values] of seen)
    if (values.size < 2)
      throw new Error(`the CPU gives ${w} one value throughout, which tests nothing`);
  note(`${layer.mod}: worst ${worst.toExponential(2)}`);
}

const dev = (d: unknown) => d as Parameters<typeof gpu>[0]['device'];

test('sparkle folds on the GPU as the CPU does', (d) =>
  agree(dev(d), { mod: 'sparkle', params: { share: 0.05 } }, ['lit'], [12, 437, 913]));

test('hue-cycle spread by column (rainbow) folds on the GPU as the CPU does', (d) =>
  agree(dev(d), LAYERS.rainbow, ['hue'], [130, 1170, 2290], 1e-3));

test('pulse spread by center, square, folds on the GPU as the CPU does', (d) =>
  agree(
    dev(d),
    { mod: 'pulse', spread: { by: 'center' }, params: { shape: 'square', phase: 0.013 } },
    ['gain'],
    [70, 410, 777],
  ));

test('bloom spread by row folds on the GPU as the CPU does', (d) =>
  agree(
    dev(d),
    { mod: 'bloom', spread: { by: 'row' }, params: { phase: 0.07 } },
    ['glow'],
    [90, 520, 951],
  ));

/** A tenth of one 8-bit step, as blits allows a color: what f32 leaves after its trip through linear sRGB. */
const COLOR = 1e-3;

test('chase folds on the GPU as the CPU does', (d) =>
  agree(dev(d), { mod: 'chase', params: { dim: 0.2 } }, ['lit', 'tint'], [40, 250, 470], COLOR));

test('flash spread by column folds on the GPU as the CPU does', (d) =>
  agree(
    dev(d),
    {
      mod: 'flash',
      spread: { by: 'column-reverse' },
      params: { flashes: 3, from: 0.2, to: 0.8, depth: 0.7 },
    },
    ['gain'],
    [130, 455, 701],
  ));

test('scanline folds on the GPU as the CPU does', (d) =>
  agree(dev(d), { mod: 'scanline', params: { band: 3 } }, ['gain', 'glow'], [60, 333, 801]));

test('shimmer folds on the GPU as the CPU does', (d) =>
  agree(
    dev(d),
    { mod: 'shimmer', params: { every: 2000, angle: -20 } },
    ['lit', 'glow', 'chroma'],
    [210, 530, 870],
  ));

test('neon in runs of columns folds on the GPU as the CPU does', (d) =>
  agree(
    dev(d),
    { mod: 'neon', params: { often: 60, length: 1500 } },
    ['gain', 'glow'],
    [1210, 7533, 23_871, 41_002, 58_317],
  ));

test('neon spread by column folds on the GPU as the CPU does', (d) =>
  agree(
    dev(d),
    { mod: 'neon', spread: { by: 'column' }, params: { often: 60, length: 1500, seed: 4 } },
    ['gain', 'glow'],
    [2210, 17_533, 33_871],
  ));

test('invert held steady folds on the GPU as the CPU does', (d) =>
  agree(dev(d), { mod: 'invert', params: { depth: 0.8 } }, ['invert'], [100, 900, 1700]));

test('invert on a triangle spread by column folds on the GPU as the CPU does', (d) =>
  agree(
    dev(d),
    { mod: 'invert', spread: { by: 'column' }, params: { shape: 'triangle', phase: 0.02 } },
    ['invert'],
    [100, 900, 1700],
  ));

test('two-color spread by column folds on the GPU as the CPU does', (d) =>
  agree(dev(d), { mod: 'two-color', spread: { by: 'column' } }, ['tint'], [110, 480, 830], COLOR));

/** The first `n` frames' middles, ms, at which `layer` turns some dot's hue, from the CPU. */
function torn(layer: LayerSpec, n: number): number[] {
  const m = mix<Subject, Pose>(KIT);
  m.sync(0);
  cueLayer(m, b, layer, 1);
  const found: number[] = [];
  for (let t = 25; t < 60_000 && found.length < n; t += 50) {
    m.sync(t);
    if (b.dots.some((s) => m.probe(s).hue !== 0)) found.push(t);
  }
  return found;
}

test('glitch folds on the GPU as the CPU does', (d) => {
  const layer: LayerSpec = { mod: 'glitch', params: { often: 120, strength: 1, seed: 3 } };
  const times = torn(layer, 4);
  if (times.length < 4) throw new Error('the CPU shows too few bursts');
  return agree(dev(d), layer, ['hue', 'gain', 'invert'], [10, ...times], 1e-3);
});

test('aurora folds on the GPU as the CPU does', (d) =>
  agree(dev(d), { mod: 'aurora', params: { speed: 0.5 } }, ['hue'], [150, 900, 1650], 1e-3));
