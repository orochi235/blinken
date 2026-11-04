import { kit } from '@msb235/blits';
import { gpu, gpuOf, max, mix, shaderPatch } from '@msb235/blits/gpu';
import { test } from './harness.js';

interface C {
  i: number;
}
type P = { lit: number };
const cells: C[] = [{ i: 0 }, { i: 1 }, { i: 2 }];

const on = shaderPatch<C, P, { k: number }>(1000, {
  params: { k: 'f32' },
  wgsl: 'out.lit = params.k;',
  at: (_phase, _c, _s, p) => ({ lit: p.k }),
  writes: ['lit'],
});

test('smoke: a shaderPatch channel lands on the GPU', async (device) => {
  const m = mix<C, P>(kit<P>({ lit: max() }), { engine: gpu({ device }) });
  m.sync(0);
  m.cue({ patch: on.with({ k: 1 }), subjects: cells, loop: true });
  const side = gpuOf(m);
  side.subjects(cells, () => ({}));
  m.sync(1);
  side.channel('lit');
  await side.ready;
  m.sync(2);
  if (side.channel('lit') === null) throw new Error('lit is not on the GPU');
});
