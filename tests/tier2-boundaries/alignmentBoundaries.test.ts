import { describe, it, expect } from 'vitest';
import { alignElements, distributeElements, computeElementBounds } from '../helpers/testOracles';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 2: Boundary & Corner Cases - Alignment & Distribution', () => {
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

  it('T2-ALIGN-1: Aligning empty array or single element returns elements unchanged without throwing', () => {
    expect(alignElements([], 'left')).toEqual([]);

    const single = [createRect('s1', 50, 50, 100, 100) as CanvasElement];
    const result = alignElements(single, 'center');
    expect(result.length).toBe(1);
    expect(result[0].x).toBe(50);
  });

  it('T2-ALIGN-2: Aligning elements that already share identical coordinates is a safe no-op', () => {
    const r1 = createRect('r1', 100, 100, 50, 50);
    const r2 = createRect('r2', 100, 100, 50, 50);

    const aligned = alignElements([r1, r2] as CanvasElement[], 'left');

    expect(aligned[0].x).toBe(100);
    expect(aligned[1].x).toBe(100);
  });

  it('T2-ALIGN-3: Distributing less than 3 elements (0, 1, or 2 items) returns elements unchanged', () => {
    expect(distributeElements([], 'horizontal')).toEqual([]);

    const single = [createRect('s1', 10, 10, 50, 50) as CanvasElement];
    expect(distributeElements(single, 'horizontal')[0].x).toBe(10);

    const pair = [createRect('p1', 10, 10, 50, 50) as CanvasElement, createRect('p2', 100, 10, 50, 50) as CanvasElement];
    const distPair = distributeElements(pair, 'horizontal');
    expect(distPair[0].x).toBe(10);
    expect(distPair[1].x).toBe(100);
  });

  it('T2-ALIGN-4: Alignment and distribution with negative coordinates handles negative bounding boxes accurately', () => {
    const r1 = createRect('neg-1', -300, -200, 50, 50);
    const r2 = createRect('neg-2', -100, -50, 50, 50);

    const aligned = alignElements([r1, r2] as CanvasElement[], 'left');
    expect(aligned[0].x).toBe(-300);
    expect(aligned[1].x).toBe(-300);
  });

  it('T2-ALIGN-5: Distributing elements with 0 width/height avoids division by zero', () => {
    const r1 = createRect('z1', 0, 0, 0, 0);
    const r2 = createRect('z2', 50, 0, 0, 0);
    const r3 = createRect('z3', 200, 0, 0, 0);

    const distributed = distributeElements([r1, r2, r3] as CanvasElement[], 'horizontal');

    expect(distributed[0].x).toBe(0);
    expect(distributed[1].x).toBe(100);
    expect(distributed[2].x).toBe(200);
    expect(Number.isNaN(distributed[1].x)).toBe(false);
  });

  it('T2-ALIGN-6: Aligning elements with extreme coordinates (1e6) executes without numeric overflow', () => {
    const r1 = createRect('ext-1', 1000000, 1000000, 100, 100);
    const r2 = createRect('ext-2', 1000200, 1000200, 100, 100);

    const aligned = alignElements([r1, r2] as CanvasElement[], 'center');

    const b1 = computeElementBounds(aligned[0]);
    const b2 = computeElementBounds(aligned[1]);
    expect(b1.centerX).toBe(b2.centerX);
  });
});
