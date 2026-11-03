import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import {
  FrameElement,
  isElementInsideFrame,
  getElementsInFrame,
  moveFrameWithChildren,
} from '../helpers/testOracles';
import { CanvasElement, RectElement, StickyElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 5 - Frames / Artboards', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(105);
  });

  afterEach(() => {
    harness.cleanup();
  });

  const createFrame = (id: string, x: number, y: number, w: number, h: number, title: string = 'Artboard'): FrameElement => ({
    id,
    type: 'frame',
    title,
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

  const createSticky = (id: string, x: number, y: number, text: string = 'Note'): StickyElement => ({
    id,
    type: 'sticky',
    x,
    y,
    width: 100,
    height: 100,
    text,
    color: 'yellow',
    fontSize: 14,
    zIndex: 2,
    updatedAt: Date.now(),
  });

  it('T1-FRAME-1: should persist FrameElement data model in Yjs elements map', () => {
    const frame = createFrame('frame-1', 100, 100, 600, 400, 'Sprint Dashboard');
    harness.setElement(frame as unknown as CanvasElement);

    const stored = harness.getElement('frame-1') as unknown as FrameElement;
    expect(stored).toBeDefined();
    expect(stored.type).toBe('frame');
    expect(stored.title).toBe('Sprint Dashboard');
    expect(stored.width).toBe(600);
    expect(stored.height).toBe(400);
  });

  it('T1-FRAME-2: should detect an element positioned within frame boundaries as inside', () => {
    const frame = createFrame('frame-2', 100, 100, 500, 400);
    // Sticky placed at x=200, y=200 (center=250, 250, well inside frame: [100..600, 100..500])
    const insideSticky = createSticky('sticky-in', 200, 200);

    expect(isElementInsideFrame(insideSticky as CanvasElement, frame)).toBe(true);
  });

  it('T1-FRAME-3: should return false for elements outside frame boundaries', () => {
    const frame = createFrame('frame-3', 100, 100, 400, 300);
    // Sticky placed at x=600, y=500 (completely outside)
    const outsideSticky = createSticky('sticky-out', 600, 500);

    expect(isElementInsideFrame(outsideSticky as CanvasElement, frame)).toBe(false);
  });

  it('T1-FRAME-4: getElementsInFrame should return list of all child elements inside frame', () => {
    const frame = createFrame('frame-4', 100, 100, 500, 500);
    const child1 = createSticky('child-1', 150, 150);
    const child2 = createSticky('child-2', 300, 300);
    const outsider = createSticky('outsider', 700, 700);

    const all = [frame as unknown as CanvasElement, child1 as CanvasElement, child2 as CanvasElement, outsider as CanvasElement];
    const children = getElementsInFrame(frame, all);

    expect(children.length).toBe(2);
    expect(children.map((c) => c.id)).toContain('child-1');
    expect(children.map((c) => c.id)).toContain('child-2');
    expect(children.map((c) => c.id)).not.toContain('outsider');
  });

  it('T1-FRAME-5: moving a frame should move all contained elements by identical displacement', () => {
    const frame = createFrame('frame-5', 100, 100, 400, 400);
    const child = createSticky('child-5', 150, 150);
    const all = [frame as unknown as CanvasElement, child as CanvasElement];

    const updated = moveFrameWithChildren(frame, all, 50, 80);

    const updatedFrame = updated.find((e) => e.id === 'frame-5')!;
    const updatedChild = updated.find((e) => e.id === 'child-5')!;

    expect(updatedFrame.x).toBe(150);
    expect(updatedFrame.y).toBe(180);
    expect(updatedChild.x).toBe(200); // 150 + 50
    expect(updatedChild.y).toBe(230); // 150 + 80
  });

  it('T1-FRAME-6: moving a frame should not move elements situated outside its boundary', () => {
    const frame = createFrame('frame-6', 100, 100, 300, 300);
    const child = createSticky('child-6', 150, 150);
    const outsider = createSticky('outsider-6', 600, 600);
    const all = [frame as unknown as CanvasElement, child as CanvasElement, outsider as CanvasElement];

    const updated = moveFrameWithChildren(frame, all, 100, 100);

    const updatedOutsider = updated.find((e) => e.id === 'outsider-6')!;
    expect(updatedOutsider.x).toBe(600);
    expect(updatedOutsider.y).toBe(600);
  });
});
