import { describe, it, expect } from 'vitest';
import { calculateSnapping, computeElementBounds } from '../helpers/testOracles';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 4 - Smart Snapping & Alignment Guides', () => {
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

  it('T1-SNAP-1: should snap to left edge when dragged element is within 5px threshold', () => {
    const stationary = createRect('stat-1', 100, 100, 100, 100);
    // Dragged object at x=103 (within 5px threshold of 100)
    const dragged = createRect('drag-1', 103, 300, 80, 80);
    const draggedBounds = computeElementBounds(dragged as CanvasElement);

    const result = calculateSnapping(draggedBounds, [stationary as CanvasElement], 5);

    expect(result.snappedX).toBe(100);
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('T1-SNAP-2: should snap to center line when dragged element center is within 5px threshold', () => {
    // stationary at x=100, w=100 -> centerX=150
    const stationary = createRect('stat-2', 100, 100, 100, 100);
    // dragged of width 80 -> needs centerX ~ 150 -> x ~ 110. Let's place at x=112 (centerX=152, diff=2px <= 5px)
    const dragged = createRect('drag-2', 112, 300, 80, 80);
    const draggedBounds = computeElementBounds(dragged as CanvasElement);

    const result = calculateSnapping(draggedBounds, [stationary as CanvasElement], 5);

    expect(result.snappedX).toBe(110); // 150 - 80/2 = 110
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('T1-SNAP-3: should snap to right edge when dragged element is within 5px of right edge', () => {
    // stationary at x=100, w=100 -> maxX=200
    const stationary = createRect('stat-3', 100, 100, 100, 100);
    // dragged of width 60 placed at x=138 -> maxX=198 (within 2px of 200)
    const dragged = createRect('drag-3', 138, 250, 60, 60);
    const draggedBounds = computeElementBounds(dragged as CanvasElement);

    const result = calculateSnapping(draggedBounds, [stationary as CanvasElement], 5);

    expect(result.snappedX).toBe(140); // 200 - 60 = 140
  });

  it('T1-SNAP-4: should snap vertical axes (top, middle, bottom) within threshold', () => {
    // stationary at y=100, h=100 (top=100, middle=150, bottom=200)
    const stationary = createRect('stat-4', 100, 100, 100, 100);
    // dragged of height 50 placed at y=98 (within 2px of top=100)
    const dragged = createRect('drag-4', 300, 98, 50, 50);
    const draggedBounds = computeElementBounds(dragged as CanvasElement);

    const result = calculateSnapping(draggedBounds, [stationary as CanvasElement], 5);

    expect(result.snappedY).toBe(100);
  });

  it('T1-SNAP-5: should produce alignment guide lines spanning through the snapped coordinate', () => {
    const stationary = createRect('stat-5', 200, 100, 100, 100);
    const dragged = createRect('drag-5', 202, 300, 100, 100);
    const draggedBounds = computeElementBounds(dragged as CanvasElement);

    const result = calculateSnapping(draggedBounds, [stationary as CanvasElement], 5);

    expect(result.guides.length).toBeGreaterThan(0);
    // Vertical guide at x=200
    const vertGuide = result.guides.find((g) => g.points[0] === 200 && g.points[2] === 200);
    expect(vertGuide).toBeDefined();
  });

  it('T1-SNAP-6: should return no snap and empty guides when distance exceeds threshold', () => {
    const stationary = createRect('stat-6', 100, 100, 100, 100);
    // 20px away from any edge
    const dragged = createRect('drag-6', 220, 220, 80, 80);
    const draggedBounds = computeElementBounds(dragged as CanvasElement);

    const result = calculateSnapping(draggedBounds, [stationary as CanvasElement], 5);

    expect(result.snappedX).toBeUndefined();
    expect(result.snappedY).toBeUndefined();
    expect(result.guides.length).toBe(0);
  });
});
