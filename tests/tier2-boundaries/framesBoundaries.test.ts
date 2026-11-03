import { describe, it, expect } from 'vitest';
import {
  FrameElement,
  isElementInsideFrame,
  getElementsInFrame,
  moveFrameWithChildren,
} from '../helpers/testOracles';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 2: Boundary & Corner Cases - Frames / Artboards', () => {
  const createFrame = (id: string, x: number, y: number, w: number, h: number): FrameElement => ({
    id,
    type: 'frame',
    title: 'Frame',
    x,
    y,
    width: w,
    height: h,
    fill: '#f8fafc',
    stroke: '#cbd5e1',
    strokeWidth: 2,
    zIndex: 1,
    updatedAt: Date.now(),
  });

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
    zIndex: 2,
    updatedAt: Date.now(),
  });

  it('T2-FRAME-1: Element whose center point is exactly on frame boundary is classified deterministically', () => {
    // Frame from 100 to 300 (x), 100 to 300 (y)
    const frame = createFrame('fb-1', 100, 100, 200, 200);

    // Element of width 40 with center at exactly x=100 (left boundary) -> x = 80..120 (centerX = 100)
    const onBoundaryRect = createRect('edge-r', 80, 150, 40, 40);

    // Bounding edge check centerX >= minX && centerX <= maxX
    expect(isElementInsideFrame(onBoundaryRect as CanvasElement, frame)).toBe(true);

    // Element with center at 99.9 (outside)
    const outsideRect = createRect('out-r', 79, 150, 40, 40);
    expect(isElementInsideFrame(outsideRect as CanvasElement, frame)).toBe(false);
  });

  it('T2-FRAME-2: Frame with zero or negative dimensions does not contain any elements', () => {
    const zeroFrame = createFrame('zero-frame', 100, 100, 0, 0);
    const rect = createRect('rect-in', 100, 100, 50, 50);

    // Element centerX is 125 > 100, so not inside zero frame
    expect(isElementInsideFrame(rect as CanvasElement, zeroFrame)).toBe(false);
  });

  it('T2-FRAME-3: Nested frames: frame inside another frame does not create infinite loop on move', () => {
    const outerFrame = createFrame('outer', 100, 100, 500, 500);
    const innerFrame = createFrame('inner', 150, 150, 200, 200);
    const innerSticky = createRect('sticky-nested', 180, 180, 50, 50);

    const all = [outerFrame as unknown as CanvasElement, innerFrame as unknown as CanvasElement, innerSticky as CanvasElement];

    // Move outer frame
    const moved = moveFrameWithChildren(outerFrame, all, 50, 50);

    const newOuter = moved.find((e) => e.id === 'outer')!;
    const newInner = moved.find((e) => e.id === 'inner')!;
    const newSticky = moved.find((e) => e.id === 'sticky-nested')!;

    expect(newOuter.x).toBe(150);
    expect(newInner.x).toBe(200);
    expect(newSticky.x).toBe(230);
  });

  it('T2-FRAME-4: Moving an empty frame (0 children) moves frame cleanly without errors', () => {
    const emptyFrame = createFrame('empty', 50, 50, 200, 200);
    const outsider = createRect('out', 500, 500, 50, 50);

    const moved = moveFrameWithChildren(emptyFrame, [emptyFrame as unknown as CanvasElement, outsider as CanvasElement], 30, 40);

    expect(moved.find((e) => e.id === 'empty')!.x).toBe(80);
    expect(moved.find((e) => e.id === 'out')!.x).toBe(500);
  });

  it('T2-FRAME-5: Moving frame by zero displacement (dx=0, dy=0) is a clean no-op', () => {
    const frame = createFrame('f0', 100, 100, 200, 200);
    const child = createRect('c0', 120, 120, 50, 50);

    const moved = moveFrameWithChildren(frame, [frame as unknown as CanvasElement, child as CanvasElement], 0, 0);

    expect(moved.find((e) => e.id === 'f0')!.x).toBe(100);
    expect(moved.find((e) => e.id === 'c0')!.x).toBe(120);
  });

  it('T2-FRAME-6: Element cannot contain itself even if it has type frame', () => {
    const frame = createFrame('self-ref', 100, 100, 200, 200);
    expect(isElementInsideFrame(frame as unknown as CanvasElement, frame)).toBe(false);
  });
});
