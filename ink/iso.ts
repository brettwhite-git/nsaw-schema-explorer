// ink/iso.ts: a small 3D-to-SVG projection engine of our own. No three.js, no WebGL, no canvas 3D.
//
// World: x to the right, y UP, z toward the viewer at yaw 0. Orthographic camera at the classic isometric
// elevation (35.264 degrees, pitch is fixed) with a free YAW about the vertical axis.
//   view-space:  xr =  x*c + z*s          (c = cos yaw, s = sin yaw)
//                zr = -x*s + z*c          (zr > 0 is toward the viewer)
//   screen:      sx = cx + k*xr
//                sy = cy + k*( -y*cos(P) + zr*sin(P) )          (y down on screen)
//   depth:       d  = zr*cos(P) + y*sin(P)                       (bigger = nearer the camera)
// Everything here is pure (no DOM), so it is unit-tested (tests/iso.test.ts).
//
// VISIBILITY AND ORDERING (the argument the renderer relies on)
//  1. Back-face culling. For an axis-aligned box the view direction toward the camera in view space is
//     (0, sin P, cos P). The top face always faces it (sin P > 0), the bottom never does, and a side face with
//     outward world normal (nx, nz) faces it iff cos P * (nz*c - nx*s) > 0. The test does not depend on where the
//     box is (orthographic), so it is a function of yaw alone: visibleFaces(basis).
//  2. Painter's order. The renderer draws SLABS (plates), each a convex box, in ascending height. Two slabs whose
//     y-intervals do not overlap are separated by a horizontal plane; the camera lies above every horizontal
//     plane (sin P > 0), so the slab above the plane is never hidden by the slab below it, for every yaw.
//     paintOrder() sorts by y0 and isVerticallySeparated() checks the premise. Inside one convex slab the
//     back-face-culled faces do not overlap on screen, so their order is free. Things lying ON a slab's top
//     face (tiles, labels) are drawn after that slab and before the next one.
//  3. Only parts that are deliberately an "x-ray" annotation (hover threads, the order-line thread, the
//     security rail) ignore rule 2: the renderer draws them last and says so in DESIGN.md.
//
// Faces are filled with the PAPER colour by the renderer so that a nearer face hides what is behind it.

export const PITCH = Math.atan(1 / Math.SQRT2); // 35.264 degrees
export const SINP = Math.sin(PITCH);
export const COSP = Math.cos(PITCH);

export type V3 = readonly [number, number, number];

export interface Cam { yaw: number; scale: number; cx: number; cy: number }
export interface Basis extends Cam { c: number; s: number }

export function basisOf(cam: Cam): Basis {
  return { yaw: cam.yaw, scale: cam.scale, cx: cam.cx, cy: cam.cy, c: Math.cos(cam.yaw), s: Math.sin(cam.yaw) };
}

export const projX = (b: Basis, x: number, z: number): number => b.cx + b.scale * (x * b.c + z * b.s);
export const projY = (b: Basis, x: number, y: number, z: number): number => b.cy + b.scale * (-y * COSP + (z * b.c - x * b.s) * SINP);
export const depthOf = (b: Basis, x: number, y: number, z: number): number => (z * b.c - x * b.s) * COSP + y * SINP;

export function project(b: Basis, p: V3): [number, number, number] {
  return [projX(b, p[0], p[2]), projY(b, p[0], p[1], p[2]), depthOf(b, p[0], p[1], p[2])];
}

/** Inverse projection of a screen point onto the horizontal plane at height y: returns world [x, z]. */
export function unprojectToPlane(b: Basis, sx: number, sy: number, y: number): [number, number] {
  const xr = (sx - b.cx) / b.scale;
  const zr = ((sy - b.cy) / b.scale + y * COSP) / SINP;
  return [xr * b.c - zr * b.s, xr * b.s + zr * b.c];
}

/** A 2D affine map: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export interface Affine { a: number; b: number; c: number; d: number; e: number; f: number }

/** The affine map from plane coordinates (u, v) to screen, for the plane through o spanned by axes u and v (3D vectors). */
export function planeAffine(bs: Basis, o: V3, u: V3, v: V3): Affine {
  const lin = (w: V3): [number, number] => [
    bs.scale * (w[0] * bs.c + w[2] * bs.s),
    bs.scale * (-w[1] * COSP + (w[2] * bs.c - w[0] * bs.s) * SINP),
  ];
  const [a, b] = lin(u), [c, d] = lin(v);
  return { a, b, c, d, e: projX(bs, o[0], o[2]), f: projY(bs, o[0], o[1], o[2]) };
}

export const applyX = (m: Affine, u: number, v: number): number => m.a * u + m.c * v + m.e;
export const applyY = (m: Affine, u: number, v: number): number => m.b * u + m.d * v + m.f;

/** Map every coordinate pair of an SVG path made of M/L/C/Q commands (what rough.js writes) through an affine map.
 *  Beziers are affine-invariant, so mapping the control points is exact. */
export function mapPathD(d: string, m: Affine): string {
  const nums = d.match(/-?\d*\.?\d+(?:e-?\d+)?|[MLCQZ]/gi) ?? [];
  let out = '';
  for (let i = 0; i < nums.length; i++) {
    const t = nums[i];
    if (/[A-Za-z]/.test(t)) { out += t; continue; }
    const u = parseFloat(t), v = parseFloat(nums[++i]);
    out += `${fmt(applyX(m, u, v))} ${fmt(applyY(m, u, v))} `;
  }
  return out;
}

/** Half-pixel rounding keeps path strings short without visible stepping. */
export const fmt = (v: number): string => String(Math.round(v * 2) / 2);

// ------------------------------------------------------------------------------------------------ boxes

export interface Box { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
export type FaceId = 'top' | 'px' | 'nx' | 'pz' | 'nz';

const SIDE_NORMALS: Record<Exclude<FaceId, 'top'>, [number, number]> = { px: [1, 0], nx: [-1, 0], pz: [0, 1], nz: [0, -1] };

/** Visible faces for this yaw, sides first, top last. Pure function of yaw. Side faces seen exactly edge-on are culled. */
export function visibleFaces(b: Basis): FaceId[] {
  const out: FaceId[] = [];
  for (const id of ['px', 'nx', 'pz', 'nz'] as const) {
    const [nx, nz] = SIDE_NORMALS[id];
    if (COSP * (nz * b.c - nx * b.s) > 1e-6) out.push(id);
  }
  out.push('top');
  return out;
}

/** The face's plane frame: origin and the two axes, and the face extent along u and v. */
export function faceFrame(box: Box, id: FaceId): { o: V3; u: V3; v: V3; lu: number; lv: number } {
  const dx = box.x1 - box.x0, dy = box.y1 - box.y0, dz = box.z1 - box.z0;
  switch (id) {
    case 'top': return { o: [box.x0, box.y1, box.z0], u: [1, 0, 0], v: [0, 0, 1], lu: dx, lv: dz };
    case 'pz': return { o: [box.x0, box.y0, box.z1], u: [1, 0, 0], v: [0, 1, 0], lu: dx, lv: dy };
    case 'nz': return { o: [box.x1, box.y0, box.z0], u: [-1, 0, 0], v: [0, 1, 0], lu: dx, lv: dy };
    case 'px': return { o: [box.x1, box.y0, box.z1], u: [0, 0, -1], v: [0, 1, 0], lu: dz, lv: dy };
    case 'nx': return { o: [box.x0, box.y0, box.z0], u: [0, 0, 1], v: [0, 1, 0], lu: dz, lv: dy };
  }
}

/** The face as four screen points (a polygon, in order). */
export function faceQuad(bs: Basis, box: Box, id: FaceId): [number, number][] {
  const { o, u, v, lu, lv } = faceFrame(box, id);
  const m = planeAffine(bs, o, u, v);
  return [[0, 0], [lu, 0], [lu, lv], [0, lv]].map(([a, c]) => [applyX(m, a, c), applyY(m, a, c)] as [number, number]);
}

/** Indexes of `boxes` in painting order (bottom first). See the ordering argument at the top of this file. */
export function paintOrder(boxes: readonly Box[]): number[] {
  return boxes.map((_, i) => i).sort((i, j) => boxes[i].y0 - boxes[j].y0 || i - j);
}

/** True when no two boxes overlap in height (the premise of the plate-order argument). */
export function isVerticallySeparated(boxes: readonly Box[]): boolean {
  const o = paintOrder(boxes);
  for (let k = 1; k < o.length; k++) if (boxes[o[k]].y0 < boxes[o[k - 1]].y1 - 1e-9) return false;
  return true;
}

/** Depth of the surface of `box` nearest the camera along the view ray through screen point (sx, sy), or null if
 *  the ray misses the box. Used by the tests to check the painter's order against real ray hits. */
export function frontDepthAt(bs: Basis, box: Box, sx: number, sy: number): number | null {
  const xr = (sx - bs.cx) / bs.scale;
  const ys = (sy - bs.cy) / bs.scale;
  // along the ray (parametrised by y): zr = (ys + y cosP)/sinP, x = xr c - zr s, z = xr s + zr c
  const k = COSP / SINP;
  const x0 = xr * bs.c - bs.s * ys / SINP, dx = -bs.s * k;
  const z0 = xr * bs.s + bs.c * ys / SINP, dz = bs.c * k;
  let lo = box.y0, hi = box.y1;
  const clip = (p0: number, dp: number, a: number, b: number): void => {
    if (Math.abs(dp) < 1e-12) { if (p0 < a || p0 > b) { lo = 1; hi = 0; } return; }
    let t0 = (a - p0) / dp, t1 = (b - p0) / dp;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0); hi = Math.min(hi, t1);
  };
  clip(x0, dx, box.x0, box.x1);
  clip(z0, dz, box.z0, box.z1);
  if (lo > hi) return null;
  const y = hi; // depth grows with y along the ray, so the nearest surface is the highest y
  return depthOf(bs, x0 + dx * y, y, z0 + dz * y);
}

/** Point in convex or concave polygon (even-odd). */
export function pointInPoly(px: number, py: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
