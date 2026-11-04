import { ENDS, PRIM } from '../prims.js';

/** `sdf` in `prims.ts`, in WGSL, reading polylines from `points`. */
export const SDF_WGSL = `
fn seg_dist(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let d = b - a;
  let len = dot(d, d);
  let t = select(0.0, clamp(dot(p - a, d) / len, 0.0, 1.0), len > 0.0);
  return length(p - a - d * t);
}
fn bar_dist(p: vec2f, ends: vec4f, hw: f32, style: f32) -> f32 {
  if (style == ${ENDS.round}.0) { return seg_dist(p, ends.xy, ends.zw) - hw; }
  let c = (ends.xy + ends.zw) * 0.5;
  let len = length(ends.zw - ends.xy);
  let u = select(vec2f(1.0, 0.0), (ends.zw - ends.xy) / len, len > 0.0);
  let along = abs(dot(p - c, u));
  let across = abs(dot(p - c, vec2f(-u.y, u.x)));
  let half_len = len * 0.5;
  if (style == ${ENDS.square}.0) {
    let q = vec2f(along - half_len, across - hw);
    return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);
  }
  return max(across - hw, (along + across - (half_len + hw)) * 0.7071067811865476);
}
fn prim_dist(kind: u32, g0: vec4f, g1: vec4f, p: vec2f, r: f32) -> f32 {
  if (kind == ${PRIM.disc}u) { return length(p - g0.xy) - r; }
  if (kind == ${PRIM.bar}u) { return bar_dist(p, g0, r, g1.y); }
  if (kind == ${PRIM.poly}u) {
    let first = u32(g0.x);
    let count = u32(g0.y);
    var d = 1e9;
    if (count == 1u) { d = length(p - points[first]); }
    for (var i = 0u; i + 1u < count; i++) {
      d = min(d, seg_dist(p, points[first + i], points[first + i + 1u]));
    }
    return d - r;
  }
  let c = (g0.xy + g0.zw) * 0.5;
  let q = abs(p - c) - ((g0.zw - g0.xy) * 0.5 - g1.x);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - g1.x;
}
fn prim_radius(kind: u32, g0: vec4f, g1: vec4f, lamp: f32) -> f32 {
  if (kind == ${PRIM.disc}u) { return g0.z * select(1.0, lamp, g0.w > 0.0); }
  if (kind == ${PRIM.bar}u) { return g1.x; }
  if (kind == ${PRIM.poly}u) { return g0.z; }
  return 0.0;
}
fn prim_glow(kind: u32, g0: vec4f, g1: vec4f) -> f32 {
  if (kind == ${PRIM.disc}u) { return g1.x; }
  if (kind == ${PRIM.bar}u) { return g1.z; }
  if (kind == ${PRIM.poly}u) { return g0.w; }
  return 0.0;
}
fn prim_box(kind: u32, g0: vec4f, g1: vec4f, r: f32) -> vec4f {
  if (kind == ${PRIM.disc}u) { return vec4f(g0.xy - r, g0.xy + r); }
  if (kind == ${PRIM.bar}u) { return vec4f(min(g0.xy, g0.zw) - r, max(g0.xy, g0.zw) + r); }
  if (kind == ${PRIM.poly}u) { return vec4f(g1.xy - r, g1.zw + r); }
  return g0;
}
`;
