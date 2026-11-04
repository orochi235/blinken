import { type Mix, mix } from '@msb235/blits';
import { gpu, gpuOf } from '@msb235/blits/gpu';
import { board, KIT, type Pose, type Subject } from '@/board.js';
import type { LayerSpec } from '@/builtins.js';
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
          const what = `${w} t ${t} ${s.kind} ${'x' in s ? `${s.x},${s.y}` : s.i} axis ${a}`;
          if (w === 'hue') close(off, 0, what, tolerance);
          else close(gv, cv, what, tolerance);
        }
      });
    }
  }
  note(`${layer.mod}: worst ${worst.toExponential(2)}`);
}

const dev = (d: unknown) => d as Parameters<typeof gpu>[0]['device'];

test('sparkle folds on the GPU as the CPU does', (d) =>
  agree(dev(d), { mod: 'sparkle', params: { share: 0.05 } }, ['lit'], [12, 437, 913]));
