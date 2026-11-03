import { describe, it, expect } from 'vitest';
import { calculateSnapping, computeElementBounds } from '../helpers/testOracles';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 2: Boundary & Corner Cases - Smart Snapping', () => {
  const createRect = (id: string, x: number, y: number, w: number, h: number): RectElement => ({
    id,
    type: 'rect',
    x,
    y,
    width: w,
    height: h,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    zIndex: 1,
    updatedAt: Date.now(),
  });

  it('T2-SNAP-1: Exactly at 5.0px distance snaps; at 5.01px distance does NOT snap', () => {
    const stationary = createRect('stat', 100, 100, 100, 100);

    // Exactly 5px away: x = 105
    const at5 = computeElementBounds(createRect('drag5', 105, 300, 50, 50) as CanvasElement);
    const snap5 = calculateSnapping(at5, [stationary as CanvasElement], 5);
    expect(snap5.snappedX).toBe(100);

    // 5.01px away: x = 105.01
    const over5 = computeElementBounds(createRect('dragOver', 105.01, 300, 50, 50) as CanvasElement);
    const snapOver = calculateSnapping(over5, [stationary as CanvasElement], 5);
    expect(snapOver.snappedX).toBeUndefined();
  });

  it('T2-SNAP-2: Multiple equidistant snapping candidates choose a deterministic snap target', () => {
    // Two stationary rects: one at x=100, one at x=200
    const s1 = createRect('s1', 100, 100, 50, 50);
    const s2 = createRect('s2', 200, 100, 50, 50);

    // Dragged object at x=103 (closer to s1 at x=100 than s2)
    const dragged = computeElementBounds(createRect('d', 103, 300, 50, 50) as CanvasElement);
    const snap = calculateSnapping(dragged, [s1 as CanvasElement, s2 as CanvasElement], 5);

    expect(snap.snappedX).toBe(100);
  });

  it('T2-SNAP-3: Snapping against an element with 0 width/height snaps to point without NaN', () => {
    const zeroElem = createRect('zero', 100, 100, 0, 0);
    const dragged = computeElementBounds(createRect('drag', 102, 200, 50, 50) as CanvasElement);

    const snap = calculateSnapping(dragged, [zeroElem as CanvasElement], 5);

    expect(snap.snappedX).toBe(100);
    expect(Number.isNaN(snap.snappedX)).toBe(false);
  });

  it('T2-SNAP-4: Snapping against empty canvas (0 other elements) returns undefined and empty guides', () => {
    const dragged = computeElementBounds(createRect('solo', 50, 50, 50, 50) as CanvasElement);
    const snap = calculateSnapping(dragged, [], 5);

    expect(snap.snappedX).toBeUndefined();
    expect(snap.snappedY).toBeUndefined();
    expect(snap.guides.length).toBe(0);
  });

  it('T2-SNAP-5: Extreme canvas coordinates (x=500000) snaps accurately within 5px threshold', () => {
    const s = createRect('huge-stat', 500000, 500000, 100, 100);
    const d = computeElementBounds(createRect('huge-drag', 500002, 600000, 100, 100) as CanvasElement);

    const snap = calculateSnapping(d, [s as CanvasElement], 5);

    expect(snap.snappedX).toBe(500000);
  });

  it('T2-SNAP-6: Guide lines have finite endpoints and do not contain NaN', () => {
    const s = createRect('s', 150, 150, 50, 50);
    const d = computeElementBounds(createRect('d', 151, 300, 50, 50) as CanvasElement);

    const snap = calculateSnapping(d, [s as CanvasElement], 5);

    expect(snap.guides.length).toBeGreaterThan(0);
    snap.guides.forEach((g) => {
      g.points.forEach((pt) => {
        expect(Number.isNaN(pt)).toBe(false);
        expect(Number.isFinite(pt)).toBe(true);
      });
    });
  });
});
