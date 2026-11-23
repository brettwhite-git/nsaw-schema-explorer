import { describe, it, expect } from 'vitest';
import { cubicBezier, dashOffset, easeDraw, easeText, labelInset, localProgress, stitchCount, stitchSteps } from '../ink/easing';
import { hatchSegments, stipplePoints } from '../ink/hatch';
import { roughPath } from '../ink/rough';
import { snapStitch, stitchGeometry } from '../site/stitches';

describe('draw-in maths', () => {
  it('easings run from 0 to 1 and are monotonic', () => {
    for (const e of [easeDraw, easeText]) {
      expect(e(0)).toBe(0);
      expect(e(1)).toBe(1);
      let prev = 0;
      for (let i = 1; i <= 100; i++) { const v = e(i / 100); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); prev = v; }
    }
  });
  it('the draw easing is slow at the ends and fast in the middle (.42,.05,.4,1)', () => {
    expect(easeDraw(0.1)).toBeLessThan(0.1);
    expect(easeDraw(0.9)).toBeGreaterThan(0.9);
    expect(cubicBezier(0, 0, 1, 1)(0.37)).toBeCloseTo(0.37, 3);
  });
  it('local progress is clamped and offset by start time', () => {
    expect(localProgress(-5, 0, 100)).toBe(0);
    expect(localProgress(50, 0, 100)).toBe(0.5);
    expect(localProgress(150, 100, 100)).toBe(0.5);
    expect(localProgress(500, 100, 100)).toBe(1);
    expect(localProgress(10, 20, 0)).toBe(0);
  });
  it('dash offset: 1 = undrawn, 0 = drawn', () => {
    expect(dashOffset(0)).toBe(1);
    expect(dashOffset(0.25)).toBe(0.75);
    expect(dashOffset(1)).toBe(0);
    expect(dashOffset(2)).toBe(0);
  });
  it('a thread is sewn in whole stitches', () => {
    expect(stitchCount(190)).toBe(20);
    expect(stitchCount(10)).toBe(4);
    expect(stitchSteps(0.51, 10)).toBe(0.5);
    expect(stitchSteps(0.99, 10)).toBe(0.9);
    expect(stitchSteps(1, 10)).toBe(1);
  });
  it('a label opens left to right', () => {
    expect(labelInset(0)).toBe(100);
    expect(labelInset(1)).toBe(0);
  });
  it('the progress driver maps 0..1 onto the same curve the clock uses', () => {
    // scroll progress p over a stroke that spans the whole drawing == time t = p * total
    const total = 1000;
    const viaProgress = (p: number) => dashOffset(easeDraw(localProgress(p * total, 0, total)));
    expect(viaProgress(0)).toBe(1);
    expect(viaProgress(1)).toBe(0);
    expect(viaProgress(0.5)).toBeCloseTo(1 - easeDraw(0.5), 9);
  });
});

describe('hatching and rough lines', () => {
  it('hatch lines stay inside the rectangle, at the asked gap', () => {
    const r = { x0: 0, y0: 0, x1: 100, y1: 7 };
    for (const angle of [0, 45, 135]) {
      const segs = hatchSegments(r, angle, 3.6);
      expect(segs.length).toBeGreaterThanOrEqual(2);
      for (const [x0, y0, x1, y1] of segs) {
        for (const [x, y] of [[x0, y0], [x1, y1]]) {
          expect(x).toBeGreaterThanOrEqual(-1e-6); expect(x).toBeLessThanOrEqual(100 + 1e-6);
          expect(y).toBeGreaterThanOrEqual(-1e-6); expect(y).toBeLessThanOrEqual(7 + 1e-6);
        }
      }
    }
    expect(hatchSegments(r, 0, 3.6).length).toBe(2);
  });
  it('same seed, same drawing; stipple is seeded', () => {
    expect(roughPath('M0 0L100 0', 5)).toBe(roughPath('M0 0L100 0', 5));
    expect(roughPath('M0 0L100 0', 5)).not.toBe(roughPath('M0 0L100 0', 6));
    expect(stipplePoints({ x0: 0, y0: 0, x1: 40, y1: 7 }, 3.4, 9)).toEqual(stipplePoints({ x0: 0, y0: 0, x1: 40, y1: 7 }, 3.4, 9));
  });
  it('stitch tiles are seeded and snap to whole stitches', () => {
    expect(stitchGeometry(false, 7)).toEqual(stitchGeometry(false, 7));
    expect(snapStitch(0)).toBe(9);
    expect(snapStitch(30)).toBe(37);
  });
});
