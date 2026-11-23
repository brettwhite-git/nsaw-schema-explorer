import { describe, it, expect } from 'vitest';
import {
  PITCH, basisOf, depthOf, faceQuad, frontDepthAt, isVerticallySeparated, mapPathD, paintOrder, planeAffine, project, projX, projY,
  unprojectToPlane, visibleFaces, applyX, applyY, type Box,
} from '../ink/iso';

const YAWS = [0, 0.4, -0.6, 1.3, 2.2, -2.9, 3.8];
const cam = (yaw: number) => basisOf({ yaw, scale: 3.1, cx: 400, cy: 300 });

describe('ink/iso: projection', () => {
  it('the pitch is the classic isometric elevation, 35.264 degrees', () => {
    expect((PITCH * 180) / Math.PI).toBeCloseTo(35.264, 3);
  });
  it('project then inverse-project onto a plane returns the point, at several yaws and heights', () => {
    for (const yaw of YAWS) for (const y of [0, 5, 41.5, 133]) {
      const b = cam(yaw);
      for (const [x, z] of [[0, 0], [-80, 55], [71.25, -63.5], [10, 10]]) {
        const [sx, sy] = project(b, [x, y, z]);
        const [rx, rz] = unprojectToPlane(b, sx, sy, y);
        expect(rx).toBeCloseTo(x, 9);
        expect(rz).toBeCloseTo(z, 9);
      }
    }
  });
  it('a plane affine map agrees with project() for every point of the plane', () => {
    for (const yaw of YAWS) {
      const b = cam(yaw);
      const m = planeAffine(b, [3, 17, -4], [1, 0, 0], [0, 0, 1]);
      for (const [u, v] of [[0, 0], [12, -7], [-30, 22]]) {
        const [sx, sy] = project(b, [3 + u, 17, -4 + v]);
        expect(applyX(m, u, v)).toBeCloseTo(sx, 9);
        expect(applyY(m, u, v)).toBeCloseTo(sy, 9);
      }
      const mv = planeAffine(b, [0, 0, 5], [1, 0, 0], [0, 1, 0]);
      const [sx, sy] = project(b, [9, 6, 5]);
      expect(applyX(mv, 9, 6)).toBeCloseTo(sx, 9);
      expect(applyY(mv, 9, 6)).toBeCloseTo(sy, 9);
    }
  });
  it('mapping a rough.js path through the affine map equals mapping its points (beziers are affine-invariant)', () => {
    const b = cam(0.7);
    const m = planeAffine(b, [0, 4, 0], [1, 0, 0], [0, 0, 1]);
    const out = mapPathD('M 10 20 C 30 20, 40 25, 50 30 L 60 70', m).trim().split(/\s+/);
    expect(out[0].startsWith('M')).toBe(true);
    const [sx, sy] = project(b, [10, 4, 20]);
    expect(Math.abs(parseFloat(out[0].slice(1)) - sx)).toBeLessThanOrEqual(0.25);
    expect(Math.abs(parseFloat(out[1]) - sy)).toBeLessThanOrEqual(0.25);
    expect(mapPathD('M 10 20 C 30 20, 40 25, 50 30 L 60 70', m).match(/C/g)!.length).toBe(1);
  });
  it('depth grows toward the camera: higher and nearer is greater', () => {
    const b = cam(0.3);
    expect(depthOf(b, 0, 10, 0)).toBeGreaterThan(depthOf(b, 0, 0, 0));
    expect(depthOf(b, 0, 0, 10)).toBeGreaterThan(depthOf(b, 0, 0, 0)); // yaw 0.3: +z is toward the viewer
  });
});

describe('ink/iso: faces', () => {
  const box: Box = { x0: -20, x1: 20, y0: 0, y1: 5, z0: -10, z1: 10 };
  it('culls back faces: at the four quadrant yaws exactly two sides and the top are visible', () => {
    const expected: Record<number, string[]> = {
      45: ['nx', 'pz', 'top'], 135: ['nx', 'nz', 'top'], 225: ['px', 'nz', 'top'], 315: ['px', 'pz', 'top'],
    };
    for (const deg of [45, 135, 225, 315]) {
      const faces = visibleFaces(cam((deg * Math.PI) / 180));
      expect([...faces].sort(), `yaw ${deg}`).toEqual([...expected[deg]].sort());
    }
  });
  it('sides come before the top (painted first) and the bottom is never visible', () => {
    for (const yaw of YAWS) {
      const f = visibleFaces(cam(yaw));
      expect(f[f.length - 1]).toBe('top');
      expect(f.length).toBeGreaterThanOrEqual(2);
      expect(f.length).toBeLessThanOrEqual(3);
    }
  });
  it('the visible faces of one box do not overlap on screen (so their order is free)', () => {
    for (const deg of [45, 135, 225, 315, 20, 100]) {
      const b = cam((deg * Math.PI) / 180);
      const polys = visibleFaces(b).map((id) => faceQuad(b, box, id));
      const area = (p: [number, number][]) => Math.abs(p.reduce((s, [x, y], i) => s + (x * p[(i + 1) % 4][1] - p[(i + 1) % 4][0] * y), 0)) / 2;
      const total = polys.reduce((s, p) => s + area(p), 0);
      // silhouette area of the box = sum of visible face areas; compare to the projected hull by sampling
      let inside = 0, n = 0;
      for (let sx = 0; sx < 800; sx += 4) for (let sy = 0; sy < 600; sy += 4) {
        const d = frontDepthAt(b, box, sx, sy);
        if (d !== null) inside++;
        n++;
      }
      expect(Math.abs(total - inside * 16) / total, `yaw ${deg}`).toBeLessThan(0.04);
      void n;
    }
  });
});

describe('ink/iso: ordering of stacked plates', () => {
  const slab = (y0: number, y1: number): Box => ({ x0: -86, x1: 86, y0, y1, z0: -59, z1: 59 });
  const stack = [slab(0, 2.6), slab(40.6, 43.2), slab(81.2, 83.8), slab(121.8, 124.4)];
  it('sorts by height and the premise (no height overlap) holds', () => {
    expect(isVerticallySeparated(stack)).toBe(true);
    expect(paintOrder([stack[2], stack[0], stack[3], stack[1]])).toEqual([1, 3, 0, 2]);
    expect(isVerticallySeparated([slab(0, 5), slab(3, 8)])).toBe(false);
  });
  it('painting bottom-first matches the nearest surface along every view ray, at every yaw', () => {
    for (const yaw of YAWS) {
      const b = cam(yaw);
      let overlaps = 0;
      for (let sx = 100; sx < 700; sx += 11) for (let sy = 60; sy < 560; sy += 11) {
        const hits = stack.map((bx, i) => ({ i, d: frontDepthAt(b, bx, sx, sy) })).filter((h) => h.d !== null) as { i: number; d: number }[];
        if (hits.length < 2) continue;
        overlaps++;
        const nearest = hits.reduce((a, c) => (c.d > a.d ? c : a));
        const lastPainted = hits.reduce((a, c) => (c.i > a.i ? c : a));
        expect(nearest.i, `yaw ${yaw} at ${sx},${sy}`).toBe(lastPainted.i);
      }
      expect(overlaps).toBeGreaterThan(50);
    }
  });
});
