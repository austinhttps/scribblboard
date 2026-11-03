import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { alignElements, distributeElements, computeElementBounds } from '../helpers/testOracles';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 3 - Alignment & Distribution Tools', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(103);
  });

  afterEach(() => {
    harness.cleanup();
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
    zIndex: 1,
    updatedAt: Date.now(),
  });

  it('T1-ALIGN-1: Align Left should align all elements to the leftmost edge (minX)', () => {
    const r1 = createRect('r1', 100, 50, 60, 40);
    const r2 = createRect('r2', 200, 150, 80, 50);
    const r3 = createRect('r3', 50, 250, 100, 60);

    const aligned = alignElements([r1, r2, r3] as CanvasElement[], 'left');

    expect(aligned[0].x).toBe(50);
    expect(aligned[1].x).toBe(50);
    expect(aligned[2].x).toBe(50);
  });

  it('T1-ALIGN-2: Align Center should align all elements to the horizontal center of their collective bounding box', () => {
    const r1 = createRect('r1', 100, 50, 50, 50); // minX=100, maxX=150
    const r2 = createRect('r2', 250, 150, 50, 50); // minX=250, maxX=300
    // collective minX=100, maxX=300 => centerX=200

    const aligned = alignElements([r1, r2] as CanvasElement[], 'center');

    const b1 = computeElementBounds(aligned[0]);
    const b2 = computeElementBounds(aligned[1]);
    expect(b1.centerX).toBe(200);
    expect(b2.centerX).toBe(200);
  });

  it('T1-ALIGN-3: Align Right should align all elements to the maximum maxX edge', () => {
    const r1 = createRect('r1', 50, 50, 60, 40); // maxX=110
    const r2 = createRect('r2', 150, 150, 100, 50); // maxX=250

    const aligned = alignElements([r1, r2] as CanvasElement[], 'right');

    const b1 = computeElementBounds(aligned[0]);
    const b2 = computeElementBounds(aligned[1]);
    expect(b1.maxX).toBe(250);
    expect(b2.maxX).toBe(250);
  });

  it('T1-ALIGN-4: Align Top, Middle, and Bottom should align along the vertical axes correctly', () => {
    const r1 = createRect('r1', 50, 100, 50, 50); // minY=100, maxY=150, centerY=125
    const r2 = createRect('r2', 150, 200, 50, 100); // minY=200, maxY=300, centerY=250
    // Collective: minY=100, maxY=300, centerY=200

    // Top
    const topAligned = alignElements([r1, r2] as CanvasElement[], 'top');
    expect(computeElementBounds(topAligned[0]).minY).toBe(100);
    expect(computeElementBounds(topAligned[1]).minY).toBe(100);

    // Middle
    const midAligned = alignElements([r1, r2] as CanvasElement[], 'middle');
    expect(computeElementBounds(midAligned[0]).centerY).toBe(200);
    expect(computeElementBounds(midAligned[1]).centerY).toBe(200);

    // Bottom
    const botAligned = alignElements([r1, r2] as CanvasElement[], 'bottom');
    expect(computeElementBounds(botAligned[0]).maxY).toBe(300);
    expect(computeElementBounds(botAligned[1]).maxY).toBe(300);
  });

  it('T1-ALIGN-5: Distribute Horizontally should create equal spacing between adjacent elements', () => {
    // 3 elements of width 50
    const r1 = createRect('r1', 0, 50, 50, 50);   // x: [0, 50]
    const r2 = createRect('r2', 70, 50, 50, 50);  // x: [70, 120]
    const r3 = createRect('r3', 300, 50, 50, 50); // x: [300, 350]
    // Total gap = (300 - 50) - 50 = 200. With 3 items (2 intervals), gap = 100 each.
    // r1: 0..50
    // r2: 50 + 100 = 150..200
    // r3: 200 + 100 = 300..350

    const distributed = distributeElements([r1, r2, r3] as CanvasElement[], 'horizontal');

    expect(distributed[0].x).toBe(0);
    expect(distributed[1].x).toBe(150);
    expect(distributed[2].x).toBe(300);

    // Gap between 1 and 2 = 150 - 50 = 100; gap between 2 and 3 = 300 - 200 = 100
    expect(distributed[1].x - (distributed[0].x + 50)).toBe(100);
    expect(distributed[2].x - (distributed[1].x + 50)).toBe(100);
  });

  it('T1-ALIGN-6: Distribute Vertically should create equal spacing between elements vertically', () => {
    // 3 elements of height 40
    const r1 = createRect('r1', 50, 0, 50, 40);
    const r2 = createRect('r2', 50, 100, 50, 40);
    const r3 = createRect('r3', 50, 240, 50, 40);
    // Total span: 240 - 40 = 200. Middle height = 40. Available gap = 160. Gap = 80.
    // r1: 0..40
    // r2: 40 + 80 = 120..160
    // r3: 160 + 80 = 240..280

    const distributed = distributeElements([r1, r2, r3] as CanvasElement[], 'vertical');

    expect(distributed[0].y).toBe(0);
    expect(distributed[1].y).toBe(120);
    expect(distributed[2].y).toBe(240);
  });

  it('T1-ALIGN-7: should commit alignment changes in a single Yjs transaction for atomic undo', () => {
    const r1 = createRect('ar-1', 10, 50, 50, 50);
    const r2 = createRect('ar-2', 100, 50, 50, 50);
    harness.setElements([r1 as CanvasElement, r2 as CanvasElement], 'remote');
    harness.undoManager.stopCapturing();

    // Align right in atomic transaction
    const aligned = alignElements([r1 as CanvasElement, r2 as CanvasElement], 'right');
    harness.setElements(aligned, 'local');

    expect(harness.getElement('ar-1')!.x).toBe(100);
    expect(harness.getElement('ar-2')!.x).toBe(100);

    // Undo reverts both elements atomically
    harness.undo();
    expect(harness.getElement('ar-1')!.x).toBe(10);
    expect(harness.getElement('ar-2')!.x).toBe(100);
  });
});
