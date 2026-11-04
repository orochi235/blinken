import type { LightTable } from '../lights.js';
import {
  ATTR,
  BLUR_FS,
  BODY_FS,
  BODY_VS,
  COPY_FS,
  FULL_VS,
  GLOW_FS,
  GLOW_VS,
  HOUSING_FS,
  HOUSING_VS,
} from './glsl.js';

/** A linked program and its uniforms by name. */
export interface Program {
  readonly program: WebGLProgram;
  readonly u: Record<string, WebGLUniformLocation | null>;
}

/** A texture to draw into. */
export interface Target {
  readonly tex: WebGLTexture;
  readonly fb: WebGLFramebuffer;
  readonly w: number;
  readonly h: number;
}

/** Every GL resource a sign holds; rebuilt whole after a lost context. */
export interface Resources {
  readonly housing: Program;
  readonly glow: Program;
  readonly body: Program;
  readonly blur: Program;
  readonly copy: Program;
  /** The lights, as instances. */
  readonly lights: WebGLVertexArrayObject;
  /** Nothing bound, for the full-target triangle. */
  readonly empty: WebGLVertexArrayObject;
  /** Five floats per light: shine, r, g, b, bloom. */
  readonly dynamic: WebGLBuffer;
  readonly buffers: readonly WebGLBuffer[];
  /** Whether the glow targets hold half floats rather than bytes. */
  readonly half: boolean;
  targets: { house: Target; splat: Target; across: Target; blurred: Target } | null;
}

const UNIFORMS = [
  'u_canvas',
  'u_pitch',
  'u_lamp',
  'u_glow',
  'u_dot',
  'u_bulb',
  'u_scale',
  'u_core',
  'u_coreTint',
  'u_coreAlpha',
  'u_src',
  'u_step',
  'u_weight',
  'u_gain',
];

function program(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const p = gl.createProgram();
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type) as WebGLShader;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost())
      throw new Error(`bree: shader failed: ${gl.getShaderInfoLog(s)}`);
    gl.attachShader(p, s);
    gl.deleteShader(s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost())
    throw new Error(`bree: program failed: ${gl.getProgramInfoLog(p)}`);
  const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(p, n)]));
  return { program: p, u };
}

function attribute(
  gl: WebGL2RenderingContext,
  at: number,
  size: number,
  stride: number,
  offset: number,
  divisor: number,
): void {
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(at, divisor);
}

/** Compiles the programs and uploads the parts of `t` that never change. */
export function build(gl: WebGL2RenderingContext, t: LightTable): Resources {
  const half = gl.getExtension('EXT_color_buffer_float') !== null;
  const lights = gl.createVertexArray();
  gl.bindVertexArray(lights);
  const corner = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corner);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  attribute(gl, ATTR.corner, 2, 0, 0, 0);
  const fixed = new Float32Array(t.n * 4);
  for (let i = 0; i < t.n; i++) {
    fixed.set([t.at[i * 2] ?? 0, t.at[i * 2 + 1] ?? 0, t.radius[i] ?? 0, t.shape[i] ?? 0], i * 4);
  }
  const statics = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, statics);
  gl.bufferData(gl.ARRAY_BUFFER, fixed, gl.STATIC_DRAW);
  attribute(gl, ATTR.at, 2, 16, 0, 1);
  attribute(gl, ATTR.radius, 1, 16, 8, 1);
  attribute(gl, ATTR.shape, 1, 16, 12, 1);
  const dynamic = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dynamic);
  gl.bufferData(gl.ARRAY_BUFFER, Math.max(t.n, 1) * 20, gl.DYNAMIC_DRAW);
  attribute(gl, ATTR.shine, 1, 20, 0, 1);
  attribute(gl, ATTR.rgb, 3, 20, 4, 1);
  attribute(gl, ATTR.bloom, 1, 20, 16, 1);
  gl.bindVertexArray(null);
  return {
    housing: program(gl, HOUSING_VS, HOUSING_FS),
    glow: program(gl, GLOW_VS, GLOW_FS),
    body: program(gl, BODY_VS, BODY_FS),
    blur: program(gl, FULL_VS, BLUR_FS),
    copy: program(gl, FULL_VS, COPY_FS),
    lights,
    empty: gl.createVertexArray(),
    dynamic,
    buffers: [corner, statics, dynamic],
    half,
    targets: null,
  };
}

function target(gl: WebGL2RenderingContext, w: number, h: number, half: boolean): Target {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}

function dropTargets(gl: WebGL2RenderingContext, r: Resources): void {
  for (const t of Object.values(r.targets ?? {})) {
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fb);
  }
  r.targets = null;
}

/** Replaces the targets for a canvas `w` × `h`: housing and splat at full size, the blur at half. */
export function sizeTargets(gl: WebGL2RenderingContext, r: Resources, w: number, h: number): void {
  dropTargets(gl, r);
  if (w === 0 || h === 0) return;
  const hw = Math.max(1, Math.ceil(w / 2));
  const hh = Math.max(1, Math.ceil(h / 2));
  r.targets = {
    house: target(gl, w, h, false),
    splat: target(gl, w, h, r.half),
    across: target(gl, hw, hh, r.half),
    blurred: target(gl, hw, hh, r.half),
  };
}

/** Deletes every resource in `r`. */
export function free(gl: WebGL2RenderingContext, r: Resources): void {
  dropTargets(gl, r);
  for (const p of [r.housing, r.glow, r.body, r.blur, r.copy]) gl.deleteProgram(p.program);
  for (const b of r.buffers) gl.deleteBuffer(b);
  gl.deleteVertexArray(r.lights);
  gl.deleteVertexArray(r.empty);
}

/** Makes `p` the program draws use. */
export function bind(gl: WebGL2RenderingContext, p: Program): void {
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(p.program);
}
