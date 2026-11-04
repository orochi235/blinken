import { oklab } from '@msb235/blits';
import { board } from '@/board.js';
import { createSign, signColumns } from '@/draw.js';
import { createMarquee } from '@/marquee.js';
import { webglSlot } from '@/render/backend.js';
import { DOT_COLOR } from '@/render/bloom-params.js';
import { lightTable } from '@/render/lights.js';
import { createWebGlSign } from '@/render/webgl/sign.js';
import { note, test } from './harness.js';

const PITCH = 24;
const TOLERANCE = 8;
/** How far the total light emitted may stray from 2D's, as a share of it. */
const LIGHT_TOLERANCE = 0.05;

/** A canvas inside a box of its own on the page. */
function canvasIn(width: number, height: number): HTMLCanvasElement {
  const box = document.createElement('div');
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
  const canvas = document.createElement('canvas');
  box.append(canvas);
  document.body.append(box);
  return canvas;
}

/** How many WebGL slots are free right now. */
function freeSlots(): number {
  const held: (() => void)[] = [];
  for (let s = webglSlot(); s; s = webglSlot()) held.push(s);
  for (const give of held) give();
  return held.length;
}

/** The 10 × 3 sign, every third dot lit `color`, as one frame's columns. */
function scene(color = 0xff0000) {
  const b = board(10, 3, false);
  const cols = signColumns(b.dots.length);
  const tint = oklab(color);
  for (let i = 0; i < b.dots.length; i += 3) {
    cols.lit[i] = 1;
    cols.tint.set(tint, i * 4);
  }
  return { b, leds: b.dots, cols };
}

const rgbOf = (hex: number) => [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
const worst = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Math.max(...[0, 1, 2].map((k) => Math.abs((a[k] as number) - (b[k] as number))));
/** The sum of every pixel's r, g and b. */
const sum = (px: ArrayLike<number>) => {
  let t = 0;
  for (let k = 0; k < px.length; k++) if (k % 4 !== 3) t += px[k] as number;
  return t;
};

/**
 * Draws the scene on a 2D sign and a WebGL one, and reads each light's center pixel from each,
 * and how much light each sign shows over its unlit housing.
 */
function drawBoth(glow: number, color?: number, brightness?: number) {
  const { b, leds, cols } = scene(color);
  const c2 = canvasIn(400, 200);
  const cg = canvasIn(400, 200);
  const flat = createSign(c2, b, leds);
  const gl = createWebGlSign(cg, b, leds, true, (x, y) => [x, y]);
  if (!gl) throw new Error('no WebGL sign');
  const lamps = { pitch: PITCH, glow, brightness };
  flat.setLamps(lamps);
  gl.setLamps(lamps);
  const ctx = c2.getContext('2d') as CanvasRenderingContext2D;
  const g = cg.getContext('webgl2') as WebGL2RenderingContext;
  const { width: w, height: h } = c2;
  if (cg.width !== w || cg.height !== h)
    throw new Error(`canvas ${cg.width}×${cg.height}, 2D ${w}×${h}`);
  const whole = new Uint8Array(w * h * 4);
  flat.render(signColumns(leds.length), 0, 16);
  const housing = sum(ctx.getImageData(0, 0, w, h).data);
  for (let k = 0; k < 4; k++) {
    flat.render(cols, 0xff9a2e, 1000);
    gl.render(cols, 0xff9a2e, 1000);
  }
  g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, whole);
  const emitted = {
    flat: sum(ctx.getImageData(0, 0, w, h).data) - housing,
    gl: sum(whole) - housing,
  };
  const t = lightTable(b, leds, (x, y) => [x, y]);
  const scale = w / t.frame.across;
  const pairs = leds.map((_, i) => {
    const x = Math.floor((t.at[i * 2] as number) * scale);
    const y = Math.floor((t.at[i * 2 + 1] as number) * scale);
    const k = ((h - 1 - y) * w + x) * 4;
    const px = [...whole.subarray(k, k + 4)];
    return { lit: cols.lit[i] === 1, flat: [...ctx.getImageData(x, y, 1, 1).data], gl: px };
  });
  flat.destroy();
  gl.destroy();
  return { pairs, emitted };
}

const LOOKS = [
  { name: 'red', color: 0xff0000, brightness: 1 },
  { name: 'dim blue', color: 0x3060c0, brightness: 0.6 },
];

test('webgl: each lit dot’s center matches 2D', async () => {
  for (const look of LOOKS) {
    const { pairs, emitted } = drawBoth(1, look.color, look.brightness);
    const lit = pairs.filter((p) => p.lit);
    const diff = Math.max(...lit.map((p) => worst(p.gl, p.flat)));
    const dark = Math.max(...pairs.filter((p) => !p.lit).map((p) => worst(p.gl, p.flat)));
    note(
      `${look.name}: lit centers worst ${diff}/255 from 2D (${lit[0]?.gl} vs ${lit[0]?.flat}); ` +
        `dark centers worst ${dark}/255; light emitted ${(emitted.gl / emitted.flat).toFixed(3)}× 2D's`,
    );
    if (diff > TOLERANCE) throw new Error(`${look.name}: a lit center is ${diff}/255 from 2D's`);
    if (dark > TOLERANCE) throw new Error(`${look.name}: a dark center is ${dark}/255 from 2D's`);
    const ratio = emitted.gl / emitted.flat;
    if (Math.abs(ratio - 1) > LIGHT_TOLERANCE)
      throw new Error(`${look.name}: emits ${ratio.toFixed(3)}× 2D's light`);
  }
});

test('webgl: a dark dot shows its socket, with no glow', async () => {
  const { pairs } = drawBoth(0);
  const socket = rgbOf(DOT_COLOR);
  const dark = pairs.filter((p) => !p.lit);
  const diff = Math.max(...dark.map((p) => worst(p.gl, socket)));
  const flat = Math.max(...dark.map((p) => worst(p.flat, socket)));
  note(`dark centers: worst ${diff}/255 from the socket (2D: ${flat}/255)`);
  if (diff > TOLERANCE) throw new Error(`a dark dot is ${diff}/255 from its socket`);
});

test('webgl: a 0 × 0 canvas renders, and destroy twice frees the slot once', async () => {
  const { b, leds, cols } = scene();
  const before = freeSlots();
  const s = createWebGlSign(canvasIn(0, 0), b, leds, true, (x, y) => [x, y]);
  if (!s) throw new Error('no WebGL sign');
  if (s.backend !== 'webgl') throw new Error(`backend ${s.backend}`);
  if (freeSlots() !== before - 1) throw new Error('the sign holds no slot');
  s.render(cols, 0xff9a2e, 16);
  s.destroy();
  s.destroy();
  if (freeSlots() !== before) throw new Error(`${freeSlots()} slots free, ${before} before`);
});

test('webgl: a lost context draws nothing, and a restored one draws again', async () => {
  const { b, leds, cols } = scene();
  const canvas = canvasIn(400, 200);
  const s = createWebGlSign(canvas, b, leds, true, (x, y) => [x, y]);
  if (!s) throw new Error('no WebGL sign');
  s.setLamps({ pitch: PITCH });
  const g = canvas.getContext('webgl2') as WebGL2RenderingContext;
  const lose = g.getExtension('WEBGL_lose_context') as WEBGL_lose_context;
  const event = (name: string) =>
    new Promise((r) => canvas.addEventListener(name, r, { once: true }));
  const lost = event('webglcontextlost');
  lose.loseContext();
  await lost;
  s.render(cols, 0xff9a2e, 1000);
  // Restoring from inside the lost event's dispatch is ignored.
  await new Promise((r) => setTimeout(r, 0));
  const restored = event('webglcontextrestored');
  lose.restoreContext();
  await restored;
  s.render(cols, 0xff9a2e, 1000);
  const t = lightTable(b, leds, (x, y) => [x, y]);
  const scale = canvas.width / t.frame.across;
  const px = new Uint8Array(4);
  const x = Math.floor((t.at[0] as number) * scale);
  const y = Math.floor((t.at[1] as number) * scale);
  g.readPixels(x, canvas.height - 1 - y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  s.destroy();
  if ((px[0] as number) < 250) throw new Error(`the first light reads ${[...px]} after restore`);
});

/** Waits for `name` on `target`, failing after `ms`. */
function eventOn(target: EventTarget, name: string, ms = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${name} within ${ms} ms`)), ms);
    target.addEventListener(
      name,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/** Destroys a sign on a canvas, waits `between`, makes another there, and reads its first light. */
async function reused(between: () => Promise<void> | void): Promise<Uint8Array> {
  const { b, leds, cols } = scene();
  const canvas = canvasIn(400, 200);
  const first = createWebGlSign(canvas, b, leds, true, (x, y) => [x, y]);
  if (!first) throw new Error('no WebGL sign');
  first.destroy();
  await between();
  const s = createWebGlSign(canvas, b, leds, true, (x, y) => [x, y]);
  if (!s) throw new Error('no second WebGL sign on the same canvas');
  s.setLamps({ pitch: PITCH });
  await eventOn(canvas, 'webglcontextrestored');
  s.render(cols, 0xff9a2e, 1000);
  const g = canvas.getContext('webgl2') as WebGL2RenderingContext;
  const t = lightTable(b, leds, (x, y) => [x, y]);
  const scale = canvas.width / t.frame.across;
  const px = new Uint8Array(4);
  const x = Math.floor((t.at[0] as number) * scale);
  const y = Math.floor((t.at[1] as number) * scale);
  g.readPixels(x, canvas.height - 1 - y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  s.destroy();
  return px;
}

test('webgl: a sign made on a destroyed sign’s canvas in the same task draws once restored', async () => {
  // As React's strict mode does: made, destroyed and made again within one task.
  const px = await reused(() => {});
  if ((px[0] as number) < 250) throw new Error(`the first light reads ${[...px]}`);
});

test('webgl: a sign made on a destroyed sign’s canvas a task later draws once restored', async () => {
  const px = await reused(() => new Promise((r) => setTimeout(r, 50)));
  if ((px[0] as number) < 250) throw new Error(`the first light reads ${[...px]}`);
});

test('webgl: a canvas whose context is lost for good gets a sign that draws nothing', async () => {
  const canvas = canvasIn(400, 200);
  const g = canvas.getContext('webgl2') as WebGL2RenderingContext;
  const lost = eventOn(canvas, 'webglcontextlost');
  g.getExtension('WEBGL_lose_context')?.loseContext();
  await lost;
  const before = freeSlots();
  const ticks: ((now: number) => void)[] = [];
  const m = createMarquee(canvas, {
    cols: 10,
    rows: 3,
    program: [{ effect: 'hold', text: 'I', hex: 0xff0000 }],
    ticker: {
      add(fn) {
        ticks.push(fn);
        return () => {};
      },
      size: 0,
    },
  });
  if (m.backend !== 'webgl') throw new Error(`backend ${m.backend}`);
  if (freeSlots() !== before) throw new Error('a sign that draws nothing holds a slot');
  for (const fn of ticks) fn(0);
  for (const fn of ticks) fn(16);
  m.destroy();
});
