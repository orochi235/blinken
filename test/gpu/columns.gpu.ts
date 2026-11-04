import { gpuOf } from '@msb235/blits/gpu';
import { createMarquee } from '@/marquee.js';
import type { Marquee, MarqueeOptions } from '@/marquee-api.js';
import { close, note, test } from './harness.js';
import { canvasIn, handleOf, manual } from './page.js';

const FRAME_MS = 16;
const SIGN: MarqueeOptions = {
  cols: 24,
  rows: 7,
  program: [{ effect: 'scroll', text: 'HI THERE', hex: 0x30c0ff }],
  fade: { rise: 0, fall: 0 },
};

/** Steps `ticker` a frame at a time from `from` to `to` ms, letting the GPU side settle after each. */
async function play(m: Marquee, ticker: ReturnType<typeof manual>, from: number, to: number) {
  for (let now = from; now <= to; now += FRAME_MS) {
    ticker.step(now);
    await gpuOf(m.mix).ready;
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** Counts the GPU side's reads of `m`'s channels from now on. */
function countReads(m: Marquee): { readonly n: number } {
  const side = gpuOf(m.mix) as unknown as { read(name: string): Promise<unknown> };
  const read = side.read.bind(side);
  const count = { n: 0 };
  side.read = (name) => {
    count.n++;
    return read(name);
  };
  return count;
}

test('columns: reading a WebGPU sign’s columns reads back what a held 2D twin folds', async (d) => {
  const device = d as unknown as GPUDevice;
  const ticker = manual();
  const g = createMarquee(canvasIn(400, 140), { ...SIGN, gpu: handleOf(device), ticker });
  if (g.backend !== 'webgpu') throw new Error(`backend ${g.backend}`);
  if (!('read' in gpuOf(g.mix))) {
    note('this blits has no read(), so columns are not read back');
    return;
  }
  await play(g, ticker, 0, 400);
  const at = g.pass()?.at ?? 0;
  g.seek(at, { hold: true });
  const cols = g.columns;
  // Held, every frame folds the same, so the frame behind is the frame shown.
  await play(g, ticker, 416, 560);

  const twinTicker = manual();
  const flat = createMarquee(canvasIn(400, 140), { ...SIGN, backend: '2d', ticker: twinTicker });
  flat.seek(at, { hold: true });
  for (let now = 0; now <= 560; now += FRAME_MS) twinTicker.step(now);
  const want = flat.columns;
  let lit = 0;
  for (const c of ['lit', 'gain', 'tint', 'glow'] as const)
    for (let i = 0; i < want[c].length; i++) {
      close(cols[c][i] as number, want[c][i] as number, `${c} ${i}`, 1e-3);
      if (c === 'lit' && (want.lit[i] as number) > 0) lit++;
    }
  note(`at ${at.toFixed(0)} ms, ${lit} of ${want.lit.length} lights lit in both`);
  if (lit === 0) throw new Error('the 2D twin shows nothing lit');
  g.destroy();
  flat.destroy();
});

test('columns: a WebGPU sign reads nothing back until its columns are read, and stops after', async (d) => {
  const device = d as unknown as GPUDevice;
  const ticker = manual();
  const g = createMarquee(canvasIn(400, 140), { ...SIGN, gpu: handleOf(device), ticker });
  if (!('read' in gpuOf(g.mix))) {
    note('this blits has no read()');
    return;
  }
  const reads = countReads(g);
  await play(g, ticker, 0, 160);
  if (reads.n > 0) throw new Error(`${reads.n} reads before anything read the columns`);
  void g.columns;
  await play(g, ticker, 176, 336);
  if (reads.n === 0) throw new Error('reading the columns started no reads');
  // Past the 60 frames reads run on for after the last look.
  await play(g, ticker, 352, 352 + 70 * FRAME_MS);
  const after = reads.n;
  await play(g, ticker, 352 + 71 * FRAME_MS, 352 + 90 * FRAME_MS);
  if (reads.n !== after) throw new Error(`${reads.n - after} reads after reading stopped`);
  note(`${after} reads while the columns were watched, none after`);
  g.destroy();
});
