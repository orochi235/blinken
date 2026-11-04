import type { Board, Led } from '../../board.js';
import type { Lamps, Sign } from '../../draw.js';
import type { Grid } from '../../grid.js';
import { webglSlot } from '../backend.js';
import { BLOOM, BULB_COLOR, DOT_COLOR, HOUSING } from '../bloom-params.js';
import { fitCanvas } from '../fit.js';
import { LAMP_SIZE, LED, lightTable } from '../lights.js';
import { createOpticsFrame, lit } from '../optics-frame.js';
import { bind, build, free, type Program, type Resources, sizeTargets, type Target } from './gl.js';
import { TAPS } from './glsl.js';

const rgb = (hex: number): [number, number, number] => [
  ((hex >> 16) & 0xff) / 255,
  ((hex >> 8) & 0xff) / 255,
  (hex & 0xff) / 255,
];

/** One axis's weights for a Gaussian of `sigma` texels, and the texels between taps. */
function gaussian(sigma: number): { weights: Float32Array; spacing: number } {
  const spacing = Math.max(1, (3 * sigma) / TAPS);
  const weights = new Float32Array(TAPS + 1);
  let sum = 0;
  for (let i = 0; i <= TAPS; i++) {
    const d = i * spacing;
    weights[i] = Math.exp(-(d * d) / (2 * sigma * sigma));
    sum += (i === 0 ? 1 : 2) * (weights[i] as number);
  }
  for (let i = 0; i <= TAPS; i++) weights[i] = (weights[i] as number) / sum;
  return { weights, spacing };
}

/**
 * A sign like `createSign`'s, drawn with WebGL 2: every light one instance, its glow blurred on
 * the GPU. Null where the page has no WebGL 2 or no WebGL context left to give.
 */
export function createWebGlSign(
  canvas: HTMLCanvasElement,
  b: Board,
  leds: readonly Led[],
  backed: boolean,
  grid: Grid,
): (Sign & { readonly backend: 'webgl' }) | null {
  const release = webglSlot();
  if (!release) return null;
  const made = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!made) {
    release();
    return null;
  }
  const gl: WebGL2RenderingContext = made;
  const table = lightTable(b, leds, grid);
  const frame = createOpticsFrame(b, leds);
  const out = lit(leds.length);
  const upload = new Float32Array(leds.length * 5);
  let lamps: Lamps = {};
  let pitch = 0;
  let res: Resources | null = gl.isContextLost() ? null : build(gl, table);
  let gone = false;

  const run = (p: Program) => {
    bind(gl, p);
    gl.uniform2f(p.u.u_canvas ?? null, canvas.width, canvas.height);
    gl.uniform1f(p.u.u_pitch ?? null, pitch);
    gl.uniform1f(p.u.u_lamp ?? null, lamps.size ?? LAMP_SIZE);
  };
  const into = (t: Target | null) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t?.fb ?? null);
    gl.viewport(0, 0, t?.w ?? canvas.width, t?.h ?? canvas.height);
  };
  const instances = (r: Resources) => {
    gl.bindVertexArray(r.lights);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, leds.length);
  };
  const full = (r: Resources, p: Program, src: Target, gain = 1) => {
    bind(gl, p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(p.u.u_src ?? null, 0);
    gl.uniform1f(p.u.u_gain ?? null, gain);
    gl.bindVertexArray(r.empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /** Paints the housing and every light's socket into its texture. */
  function paintHousing(r: Resources): void {
    if (!r.targets) return;
    into(r.targets.house);
    const [hr, hg, hb] = backed ? rgb(HOUSING) : [0, 0, 0];
    gl.clearColor(hr, hg, hb, backed ? 1 : 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    run(r.housing);
    gl.uniform3f(r.housing.u.u_dot ?? null, ...rgb(DOT_COLOR));
    gl.uniform3f(r.housing.u.u_bulb ?? null, ...rgb(BULB_COLOR));
    instances(r);
  }

  /** Blurs the splat along one axis into `dst`, `sigma` texels of `src` wide. */
  function blur(r: Resources, src: Target, dst: Target, sigma: number, x: boolean): void {
    const { weights, spacing } = gaussian(sigma);
    into(dst);
    bind(gl, r.blur);
    gl.uniform1fv(r.blur.u.u_weight ?? null, weights);
    gl.uniform2f(r.blur.u.u_step ?? null, x ? spacing / src.w : 0, x ? 0 : spacing / src.h);
    full(r, r.blur, src);
  }

  function draw(r: Resources, spread: number): void {
    const t = r.targets;
    if (!t) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, r.dynamic);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, upload);
    const sigma = pitch * BLOOM.spread * spread;
    const glows = sigma > 0;
    if (glows) {
      into(t.splat);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      run(r.glow);
      gl.uniform1f(r.glow.u.u_glow ?? null, spread);
      gl.uniform1f(r.glow.u.u_scale ?? null, r.half ? 1 : 0.5);
      instances(r);
      gl.disable(gl.BLEND);
      blur(r, t.splat, t.across, sigma, true);
      blur(r, t.across, t.blurred, sigma / 2, false);
    }
    into(null);
    gl.disable(gl.BLEND);
    full(r, r.copy, t.house);
    gl.enable(gl.BLEND);
    // As in 2D, glow and bodies both add onto the housing.
    gl.blendFunc(gl.ONE, gl.ONE);
    if (glows) full(r, r.copy, t.blurred, r.half ? 1 : 2);
    run(r.body);
    gl.uniform1f(r.body.u.u_core ?? null, LED.core);
    gl.uniform3f(r.body.u.u_coreTint ?? null, ...rgb(LED.coreTint));
    gl.uniform1f(r.body.u.u_coreAlpha ?? null, LED.coreAlpha);
    instances(r);
  }

  function sized(next: number): void {
    pitch = next;
    if (!res) return;
    sizeTargets(gl, res, canvas.width, canvas.height);
    paintHousing(res);
  }
  const fit = fitCanvas(canvas, table.frame.across, table.frame.down, () => lamps.pitch, sized);

  const onLost = (e: Event) => {
    e.preventDefault();
    res = null;
  };
  const onRestored = () => {
    res = build(gl, table);
    sized(pitch);
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    backend: 'webgl',
    render(cols, fallback, dt) {
      const bright = Math.max(lamps.brightness ?? 1, 0);
      frame.step(cols, fallback, dt, bright, out);
      if (!res || canvas.width === 0 || canvas.height === 0) return;
      for (let i = 0; i < leds.length; i++) {
        upload[i * 5] = out.shine[i] as number;
        upload.set(out.rgb.subarray(i * 3, i * 3 + 3), i * 5 + 1);
        upload[i * 5 + 4] = out.bloom[i] as number;
      }
      draw(res, Math.max(lamps.glow ?? 1, 0));
    },
    setDefects(defects) {
      frame.setDefects(defects);
    },
    setFade(next) {
      frame.setFade(next);
    },
    setGhost(next) {
      frame.setGhost(next);
    },
    setLamps(next) {
      lamps = next;
      fit.refit();
    },
    destroy() {
      if (gone) return;
      gone = true;
      fit.stop();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (res) free(gl, res);
      res = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      release();
    },
  };
}
