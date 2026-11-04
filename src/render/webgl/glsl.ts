/** Where each light's quad attribute sits, shared by every instanced program. */
export const ATTR = { corner: 0, at: 1, radius: 2, shape: 3, shine: 4, rgb: 5, bloom: 6 } as const;

/** The blur's taps either side of center. */
export const TAPS = 16;

const instance = `#version 300 es
layout(location = ${ATTR.corner}) in vec2 a_corner;
layout(location = ${ATTR.at}) in vec2 a_at;
layout(location = ${ATTR.radius}) in float a_radius;
layout(location = ${ATTR.shape}) in float a_shape;
layout(location = ${ATTR.shine}) in float a_shine;
layout(location = ${ATTR.rgb}) in vec3 a_rgb;
layout(location = ${ATTR.bloom}) in float a_bloom;
uniform vec2 u_canvas;
uniform float u_pitch;
uniform float u_lamp;
out vec2 v_local;
out float v_r;
out float v_shape;
out float v_shine;
out vec3 v_rgb;
vec4 place(float reach) {
  v_local = a_corner * reach;
  vec2 p = a_at * u_pitch + v_local;
  return vec4(p.x / u_canvas.x * 2.0 - 1.0, 1.0 - p.y / u_canvas.y * 2.0, 0.0, 1.0);
}
const vec4 NOWHERE = vec4(2.0, 2.0, 2.0, 1.0);
`;

/** A light's socket, drawn once per resize into the housing. */
export const HOUSING_VS = `${instance}
void main() {
  v_r = a_radius * u_lamp * u_pitch;
  v_shape = a_shape;
  gl_Position = place(v_r + 1.0);
}`;

export const HOUSING_FS = `#version 300 es
precision highp float;
uniform vec3 u_dot;
uniform vec3 u_bulb;
in vec2 v_local;
in float v_r;
in float v_shape;
out vec4 color;
void main() {
  float cover = 1.0 - smoothstep(v_r - 0.5, v_r + 0.5, length(v_local));
  color = vec4(v_shape > 0.5 ? u_bulb : u_dot, 1.0) * cover;
}`;

/**
 * A light's glow before the blur: a Gaussian with the second moment of 2D's halo disk, carrying the
 * disk's whole light, so the blurred sum matches 2D's.
 */
export const GLOW_VS = `${instance}
uniform float u_glow;
out float v_sigma;
out float v_peak;
void main() {
  float halo = a_radius * u_lamp * u_pitch * max(a_bloom * u_glow, 0.0);
  v_sigma = max(halo * 0.5, 0.7);
  v_peak = halo * halo / (2.0 * v_sigma * v_sigma);
  v_shine = a_shine;
  v_rgb = a_rgb;
  gl_Position = a_shine > 0.0 && halo > 0.0 ? place(v_sigma * 3.0) : NOWHERE;
}`;

export const GLOW_FS = `#version 300 es
precision highp float;
uniform float u_scale;
in vec2 v_local;
in float v_shine;
in vec3 v_rgb;
in float v_sigma;
in float v_peak;
out vec4 color;
void main() {
  float g = v_peak * exp(-dot(v_local, v_local) / (2.0 * v_sigma * v_sigma)) * v_shine * u_scale;
  color = vec4(v_rgb * g, g);
}`;

/** A light's lens: its color over a disk, a pale core over the center. */
export const BODY_VS = `${instance}
void main() {
  v_r = a_radius * u_lamp * u_pitch;
  v_shine = a_shine;
  v_rgb = a_rgb;
  gl_Position = a_shine > 0.0 ? place(v_r + 1.0) : NOWHERE;
}`;

export const BODY_FS = `#version 300 es
precision highp float;
uniform float u_core;
uniform vec3 u_coreTint;
uniform float u_coreAlpha;
in vec2 v_local;
in float v_r;
in float v_shine;
in vec3 v_rgb;
out vec4 color;
void main() {
  float d = length(v_local);
  float body = v_shine * (1.0 - smoothstep(v_r - 0.5, v_r + 0.5, d));
  float rc = v_r * u_core;
  float soft = max(0.5, rc * 0.25);
  float core = v_shine * u_coreAlpha * (1.0 - smoothstep(rc - soft, rc + soft, d));
  color = vec4(u_coreTint * core + v_rgb * body * (1.0 - core), core + body * (1.0 - core));
}`;

/** A triangle covering the target, its texture coordinates running 0..1 across it. */
export const FULL_VS = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  v_uv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

/** One axis of a Gaussian blur, its weights summing to 1; past the edge is dark, as in 2D. */
export const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_step;
uniform float u_weight[${TAPS + 1}];
in vec2 v_uv;
out vec4 color;
vec4 tap(vec2 uv) {
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture(u_src, uv) * inside.x * inside.y;
}
void main() {
  vec4 sum = tap(v_uv) * u_weight[0];
  for (int i = 1; i <= ${TAPS}; i++) {
    vec2 off = u_step * float(i);
    sum += (tap(v_uv + off) + tap(v_uv - off)) * u_weight[i];
  }
  color = sum;
}`;

export const COPY_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform float u_gain;
in vec2 v_uv;
out vec4 color;
void main() {
  color = texture(u_src, v_uv) * u_gain;
}`;
