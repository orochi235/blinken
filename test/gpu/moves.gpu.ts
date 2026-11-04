import { type Mix, mix, type Patch } from '@msb235/blits';
import { gpu, gpuOf } from '@msb235/blits/gpu';
import { board, everyOf, KIT, type Pose, type Subject } from '@/board.js';
import { fieldsOf } from '@/modulators/shader.js';
import { type Joins, LOOSE, MOVES, type MoveName } from '@/moves/index.js';
import { placeText } from '@/orders.js';
import { values } from '@/params.js';
import { close, note, nudge, readBack, test } from './harness.js';

const b = board(60, 7);
const all = everyOf(b);
const MESSAGES = ['HI', 'A MESSAGE FAR WIDER THAN THE BOARD'];
const PHASES = [0.04, 0.27, 0.49, 0.62, 0.93];
const setting = {} as never;

type Device = Parameters<typeof gpu>[0]['device'];

/**
 * Cues `name`'s shader form on every subject of a 60 × 7 board under the gpu engine, and its plain
 * patch on the dots under the CPU mixer, and checks `lit`, read back from the GPU, against the
 * CPU's `probe` for every subject at 5 phases of a pass, for a message narrower and one wider than
 * the board. A `floor` or branch landing on the other side of a step passes where the plain patch
 * one f32 step of phase either way gives what the GPU did. Notes the largest disagreement.
 */
async function agree(
  device: Device,
  name: MoveName,
  given: Record<string, unknown> = {},
  joins: Joins = LOOSE,
): Promise<void> {
  const m = MOVES[name];
  let worst = 0;
  for (const text of MESSAGES) {
    const at = placeText(b, text);
    const p = values(m, given as never) as never;
    const shaded = m.shader?.(at, p, joins);
    if (!shaded) throw new Error(`${name} has no shader here`);
    const plain = m.patch(at, p, joins) as Patch<Subject, Pose>;
    const make = (engine?: ReturnType<typeof gpu>) => {
      const x: Mix<Subject, Pose> = mix<Subject, Pose>(KIT, engine ? { engine } : {});
      x.sync(0);
      if (engine) x.cue({ patch: shaded, subjects: all, loop: true });
      else x.cue({ patch: plain, subjects: b.dots, loop: true });
      return x;
    };
    const g = make(gpu({ device }));
    const c = make();
    const side = gpuOf(g);
    side.subjects(all, fieldsOf);
    side.channel('lit');
    await side.ready;
    const seen = new Set<number>();
    for (const ph of PHASES) {
      const t = ph * shaded.duration;
      g.sync(t);
      c.sync(t);
      const ch = side.channel('lit');
      if (ch === null) throw new Error(`${name}: lit is not on the GPU`);
      const got = await readBack(device, ch.buffer, ch.offset, all.length * 4);
      all.forEach((s, i) => {
        const gv = got[i] as number;
        const want = c.probe(s).lit;
        seen.add(want);
        const near = [ph, nudge(ph, -1), nudge(ph, 1)].map((q) =>
          s.kind === 'cell' ? 0 : (plain.at(q, s, setting).lit ?? 0),
        );
        const off = Math.min(Math.abs(gv - want), ...near.map((v) => Math.abs(gv - v)));
        worst = Math.max(worst, off);
        const what = `${name} "${text}" phase ${ph} ${s.kind} ${'x' in s ? `${s.x},${s.y}` : s.i}`;
        close(off, 0, what);
      });
    }
    if (seen.size < 2) throw new Error(`${name}: the CPU gives lit one value throughout`);
  }
  note(
    `${name} ${JSON.stringify(given)} ${JSON.stringify(joins)}: worst ${worst.toExponential(2)}`,
  );
}

const dev = (d: unknown) => d as Device;

test('stand folds on the GPU as the CPU does', (d) => agree(dev(d), 'stand'));

test('cut-on folds on the GPU as the CPU does', (d) => agree(dev(d), 'cut-on'));

test('cut-off folds on the GPU as the CPU does', (d) => agree(dev(d), 'cut-off'));

test('scroll-in and scroll-out, both ways, fold on the GPU as the CPU does', async (d) => {
  for (const name of ['scroll-in', 'scroll-out'] as const)
    for (const direction of ['left', 'right']) await agree(dev(d), name, { direction });
});

test('drop-in and drop-out fold on the GPU as the CPU does', async (d) => {
  for (const name of ['drop-in', 'drop-out'] as const) await agree(dev(d), name);
});

test('type-on and type-off, each cursor, fold on the GPU as the CPU does', async (d) => {
  for (const name of ['type-on', 'type-off'] as const)
    for (const cursor of ['block', 'line', 'off']) await agree(dev(d), name, { cursor });
});

test('roll-away folds on the GPU as the CPU does', (d) => agree(dev(d), 'roll-away'));

test('split-in and split-out, both ways, fold on the GPU as the CPU does', async (d) => {
  for (const name of ['split-in', 'split-out'] as const)
    for (const direction of ['left', 'right']) await agree(dev(d), name, { direction });
});

test('scroll-across, alone and joined each way, folds on the GPU as the CPU does', async (d) => {
  for (const from of [false, true])
    for (const to of [false, true])
      for (const direction of ['left', 'right'])
        await agree(dev(d), 'scroll-across', { direction }, { from, to });
});
