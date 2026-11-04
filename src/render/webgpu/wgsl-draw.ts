import { TAPS } from '../blur.js';
import { SHOWS } from './wgsl-optics.js';

/**
 * The WebGL sign's shaders (`webgl/glsl.ts`) in WGSL: each light one instance of a quad, reading
 * its place from `fixed` and what it shows from the optics' `shows`.
 */
const INSTANCE = `
struct U {
  canvas: vec2f, pitch: f32, lamp: f32,
  glow: f32, core: f32, core_alpha: f32, pad: f32,
  dot: vec4f, bulb: vec4f, core_tint: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> fixed: array<vec4f>;
@group(0) @binding(2) var<storage, read> shows: array<f32>;
struct V {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f,
  @location(1) r: f32,
  @location(2) shape: f32,
  @location(3) shine: f32,
  @location(4) rgb: vec3f,
  @location(5) sigma: f32,
  @location(6) peak: f32,
}
const NOWHERE = vec4f(2.0, 2.0, 2.0, 1.0);
fn light(k: u32, i: u32) -> V {
  var v: V;
  let f = fixed[i];
  let q = i * ${SHOWS}u;
  v.local = vec2f(select(-1.0, 1.0, (k & 1u) == 1u), select(-1.0, 1.0, k >= 2u));
  v.r = f.z * u.lamp * u.pitch;
  v.shape = f.w;
  v.shine = shows[q];
  v.rgb = vec3f(shows[q + 1u], shows[q + 2u], shows[q + 3u]);
  return v;
}
fn place(v: ptr<function, V>, at: vec2f, reach: f32) {
  (*v).local = (*v).local * reach;
  let p = at * u.pitch + (*v).local;
  (*v).pos = vec4f(p.x / u.canvas.x * 2.0 - 1.0, 1.0 - p.y / u.canvas.y * 2.0, 0.0, 1.0);
}
`;

/** A light's socket, drawn once per resize into the housing. */
export const HOUSING_WGSL = `${INSTANCE}
@vertex fn vs(@builtin(vertex_index) k: u32, @builtin(instance_index) i: u32) -> V {
  var v = light(k, i);
  place(&v, fixed[i].xy, v.r + 1.0);
  return v;
}
@fragment fn fs(v: V) -> @location(0) vec4f {
  let cover = 1.0 - smoothstep(v.r - 0.5, v.r + 0.5, length(v.local));
  return vec4f(select(u.dot.rgb, u.bulb.rgb, v.shape > 0.5), 1.0) * cover;
}`;

/** A light's glow before the blur, as `GLOW_VS` and `GLOW_FS` paint it. */
export const GLOW_WGSL = `${INSTANCE}
@vertex fn vs(@builtin(vertex_index) k: u32, @builtin(instance_index) i: u32) -> V {
  var v = light(k, i);
  let halo = v.r * max(shows[i * ${SHOWS}u + 4u] * u.glow, 0.0);
  v.sigma = max(halo * 0.5, 0.7);
  v.peak = halo * halo / (2.0 * v.sigma * v.sigma);
  place(&v, fixed[i].xy, v.sigma * 3.0);
  if (!(v.shine > 0.0 && halo > 0.0)) { v.pos = NOWHERE; }
  return v;
}
@fragment fn fs(v: V) -> @location(0) vec4f {
  let g = v.peak * exp(-dot(v.local, v.local) / (2.0 * v.sigma * v.sigma)) * v.shine;
  return vec4f(v.rgb * g, g);
}`;

/** A light's lens: its color over a disk, a pale core over the center. */
export const BODY_WGSL = `${INSTANCE}
@vertex fn vs(@builtin(vertex_index) k: u32, @builtin(instance_index) i: u32) -> V {
  var v = light(k, i);
  place(&v, fixed[i].xy, v.r + 1.0);
  if (!(v.shine > 0.0)) { v.pos = NOWHERE; }
  return v;
}
@fragment fn fs(v: V) -> @location(0) vec4f {
  let d = length(v.local);
  let body = v.shine * (1.0 - smoothstep(v.r - 0.5, v.r + 0.5, d));
  let rc = v.r * u.core;
  let soft = max(0.5, rc * 0.25);
  let core = v.shine * u.core_alpha * (1.0 - smoothstep(rc - soft, rc + soft, d));
  return vec4f(u.core_tint.rgb * core + v.rgb * body * (1.0 - core), core + body * (1.0 - core));
}`;

const FULL = `
@group(0) @binding(0) var smp: sampler;
@group(0) @binding(1) var src: texture_2d<f32>;
struct F { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@vertex fn vs(@builtin(vertex_index) k: u32) -> F {
  let p = vec2f(select(-1.0, 3.0, k == 1u), select(-1.0, 3.0, k == 2u));
  return F(vec4f(p, 0.0, 1.0), vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5));
}`;

/** One axis of a Gaussian blur, its weights summing to 1; past the edge is dark, as in 2D. */
export const BLUR_WGSL = `${FULL}
struct B { step: vec2f, pad: vec2f, weight: array<vec4f, ${Math.ceil((TAPS + 1) / 4)}> }
@group(0) @binding(2) var<uniform> b: B;
fn tap(uv: vec2f) -> vec4f {
  let inside = step(vec2f(0.0), uv) * step(uv, vec2f(1.0));
  return textureSampleLevel(src, smp, uv, 0.0) * inside.x * inside.y;
}
fn weight(i: u32) -> f32 { return b.weight[i / 4u][i % 4u]; }
@fragment fn fs(f: F) -> @location(0) vec4f {
  var sum = tap(f.uv) * weight(0u);
  for (var i = 1u; i <= ${TAPS}u; i++) {
    let off = b.step * f32(i);
    sum += (tap(f.uv + off) + tap(f.uv - off)) * weight(i);
  }
  return sum;
}`;

export const COPY_WGSL = `${FULL}
@fragment fn fs(f: F) -> @location(0) vec4f {
  return textureSampleLevel(src, smp, f.uv, 0.0);
}`;
