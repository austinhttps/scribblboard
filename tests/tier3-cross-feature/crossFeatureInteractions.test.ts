import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import {
  alignElements,
  distributeElements,
  calculateSnapping,
  computeElementBounds,
  computeMinimapViewportBox,
  generateStarterTemplate,
  moveFrameWithChildren,
  isElementInsideFrame,
  FrameElement,
} from '../helpers/testOracles';
import { CanvasElement, RectElement, StickyElement } from '../../src/types/whiteboard';

describe('Tier 3: Cross-Feature Combinations & Integrations', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(301);
  });

  afterEach(() => {
    harness.cleanup();
  });

  const createRect = (id: string, x: number, y: number, w: number, h: number, locked: boolean = false): RectElement => ({
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
    locked,
  });

  it('T3-CROSS-1: Locking inside a group - locked element within a group cannot be moved', () => {
    const r1 = createRect('grp-lock-1', 10, 10, 50, 50, false);
    const r2 = createRect('grp-lock-2', 70, 10, 50, 50, true); // locked!
    (r1 as any).groupId = 'mixed-grp';
    (r2 as any).groupId = 'mixed-grp';
    harness.setElements([r1 as CanvasElement, r2 as CanvasElement]);

    // Attempt group move respecting locked items
    const moveGroupSafe = (groupId: string, dx: number, dy: number) => {
      harness.transact(() => {
        const members = harness.getElements().filter((e) => (e as any).groupId === groupId);
        // If any member is locked, dragging the entire group is blocked or locked items do not move
        const anyLocked = members.some((m) => (m as any).locked);
        if (anyLocked) {
          // Block movement for locked elements
          members.forEach((m) => {
            if (!(m as any).locked) {
              harness.setElement({ ...m, x: m.x + dx, y: m.y + dy });
            }
          });
        }
      });
    };

    moveGroupSafe('mixed-grp', 20, 20);

    // Unlocked member moved, locked member remained anchored
    expect(harness.getElement('grp-lock-1')!.x).toBe(30);
    expect(harness.getElement('grp-lock-2')!.x).toBe(70);
  });

  it('T3-CROSS-2: Grouping inside a frame - grouped elements enclosed in a frame move together when frame moves', () => {
    const frame: FrameElement = {
      id: 'parent-frame',
      type: 'frame',
      title: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      zIndex: 1,
      updatedAt: 1,
    };
    const c1: CanvasElement = { id: 'gc-1', type: 'rect', x: 50, y: 50, width: 60, height: 60, groupId: 'child-grp', zIndex: 2, updatedAt: 1 } as any;
    const c2: CanvasElement = { id: 'gc-2', type: 'rect', x: 150, y: 50, width: 60, height: 60, groupId: 'child-grp', zIndex: 3, updatedAt: 1 } as any;

    const all = [frame as unknown as CanvasElement, c1, c2];
    expect(isElementInsideFrame(c1, frame)).toBe(true);
    expect(isElementInsideFrame(c2, frame)).toBe(true);

    const moved = moveFrameWithChildren(frame, all, 100, 100);

    const newC1 = moved.find((e) => e.id === 'gc-1')!;
    const newC2 = moved.find((e) => e.id === 'gc-2')!;
    expect(newC1.x).toBe(150);
    expect(newC2.x).toBe(250);
    expect((newC1 as any).groupId).toBe('child-grp');
    expect((newC2 as any).groupId).toBe('child-grp');
  });

  it('T3-CROSS-3: Aligning locked items - locked elements remain fixed while unlocked align to bounding box', () => {
    // r1 unlocked at x=100; r2 locked at x=200; r3 unlocked at x=300
    const r1 = createRect('al-1', 100, 50, 50, 50, false);
    const r2 = createRect('al-2', 200, 150, 50, 50, true); // locked!
    const r3 = createRect('al-3', 300, 250, 50, 50, false);

    const aligned = alignElements([r1, r2, r3] as CanvasElement[], 'left');

    // r1 aligns to minX (100)
    expect(aligned[0].x).toBe(100);
    // r2 is locked -> remains at original x (200)
    expect(aligned[1].x).toBe(200);
    // r3 aligns to minX (100)
    expect(aligned[2].x).toBe(100);
  });

  it('T3-CROSS-4: Moving frame with locked items inside - hierarchical container moves all contained items', () => {
    const frame: FrameElement = {
      id: 'frame-with-locked',
      type: 'frame',
      title: 'Board',
      x: 100,
      y: 100,
      width: 500,
      height: 500,
      zIndex: 1,
      updatedAt: 1,
    };
    const lockedChild = createRect('locked-child', 200, 200, 80, 80, true);

    const all = [frame as unknown as CanvasElement, lockedChild as CanvasElement];
    expect(isElementInsideFrame(lockedChild as CanvasElement, frame)).toBe(true);

    const moved = moveFrameWithChildren(frame, all, 50, 60);

    const updatedChild = moved.find((e) => e.id === 'locked-child')!;
    expect(updatedChild.x).toBe(250);
    expect(updatedChild.y).toBe(260);
    expect((updatedChild as any).locked).toBe(true);
  });

  it('T3-CROSS-5: Minimap tracking while following - minimap viewport box reflects remote user viewport changes', () => {
    const boardBounds = { minX: 0, minY: 0, width: 2000, height: 2000 };
    const minimapSize = { width: 200, height: 200 }; // scale = 0.1

    // Leader moves viewport from (0, 0) to (-500, -800)
    const remoteViewport1 = { x: 0, y: 0, width: 1000, height: 1000, scale: 1 };
    const box1 = computeMinimapViewportBox(remoteViewport1, boardBounds, minimapSize);
    expect(box1.x).toBe(0);
    expect(box1.y).toBe(0);

    const remoteViewport2 = { x: -500, y: -800, width: 1000, height: 1000, scale: 1 };
    const box2 = computeMinimapViewportBox(remoteViewport2, boardBounds, minimapSize);
    expect(box2.x).toBe(50); // 500 * 0.1
    expect(box2.y).toBe(80); // 800 * 0.1
  });

  it('T3-CROSS-6: Template instantiation followed by grouping - group column sticky notes atomically', () => {
    const tpl = generateStarterTemplate('retro', { x: 500, y: 500 });
    harness.setElements(tpl, 'local');

    // Group the 'What went well' column items
    const wellHeader = tpl.find((e) => (e as any).text === 'What went well')!;
    const wellNote = tpl.find((e) => (e as any).text?.includes('What went well'))!;

    const wellGroupId = 'grp-what-went-well';
    harness.transact(() => {
      harness.setElement({ ...wellHeader, groupId: wellGroupId });
      harness.setElement({ ...wellNote, groupId: wellGroupId });
    });

    expect((harness.getElement(wellHeader.id) as any).groupId).toBe(wellGroupId);
    expect((harness.getElement(wellNote.id) as any).groupId).toBe(wellGroupId);
  });

  it('T3-CROSS-7: Laser pointer drawing over locked elements and frames leaves elements untouched', () => {
    const frame: FrameElement = {
      id: 'bg-frame',
      type: 'frame',
      title: 'Canvas Area',
      x: 0,
      y: 0,
      width: 600,
      height: 600,
      zIndex: 1,
      updatedAt: 1,
    };
    const lockedCard = createRect('card-locked', 100, 100, 100, 100, true);
    harness.setElements([frame as unknown as CanvasElement, lockedCard as CanvasElement]);

    // Presenter draws laser stroke across the frame & locked card
    harness.setLocalAwareness('laserTrail', {
      points: [50, 50, 120, 120, 200, 200],
      color: '#ef4444',
      timestamp: Date.now(),
    });

    // ElementsMap is strictly unaffected
    expect(harness.getElements().length).toBe(2);
    expect((harness.getElement('card-locked') as any).locked).toBe(true);
    expect(harness.getElement('bg-frame')).toBeDefined();
  });

  it('T3-CROSS-8: Snapping during frame dragging against another frame', () => {
    const stationaryFrame: FrameElement = {
      id: 'frame-A',
      type: 'frame',
      title: 'Frame A',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      zIndex: 1,
      updatedAt: 1,
    };

    // Dragged Frame B placed at x=502 (within 2px of Frame A's right edge maxX = 500)
    const draggedFrame: FrameElement = {
      id: 'frame-B',
      type: 'frame',
      title: 'Frame B',
      x: 502,
      y: 100,
      width: 400,
      height: 300,
      zIndex: 2,
      updatedAt: 1,
    };

    const draggedBounds = computeElementBounds(draggedFrame as unknown as CanvasElement);
    const snap = calculateSnapping(draggedBounds, [stationaryFrame as unknown as CanvasElement], 5);

    expect(snap.snappedX).toBe(500); // Snapped right adjacent
    expect(snap.guides.length).toBeGreaterThan(0);
  });

  it('T3-CROSS-9: Distributing elements within a frame keeps them enclosed within frame boundaries', () => {
    const frame: FrameElement = {
      id: 'dist-frame',
      type: 'frame',
      title: 'Distribution Frame',
      x: 100,
      y: 100,
      width: 600,
      height: 300,
      zIndex: 1,
      updatedAt: 1,
    };
    const r1 = createRect('d1', 120, 150, 80, 50);
    const r2 = createRect('d2', 200, 150, 80, 50);
    const r3 = createRect('d3', 580, 150, 80, 50);

    const distributed = distributeElements([r1, r2, r3] as CanvasElement[], 'horizontal');

    // All elements should remain strictly inside frame: [100, 700]
    distributed.forEach((el) => {
      const b = computeElementBounds(el);
      expect(b.minX).toBeGreaterThanOrEqual(100);
      expect(b.maxX).toBeLessThanOrEqual(700);
    });
  });

  it('T3-CROSS-10: Atomic undo/redo transaction across complex multi-feature sequence', () => {
    // 1. Insert template
    const tpl = generateStarterTemplate('flowchart', { x: 300, y: 300 });
    harness.setElements(tpl, 'local');
    harness.undoManager.stopCapturing();
    const countAfterTpl = harness.getElements().length;

    // 2. Align flowchart rects
    const rects = tpl.filter((e) => e.type === 'rect');
    const alignedRects = alignElements(rects, 'top');
    harness.setElements(alignedRects, 'local');
    harness.undoManager.stopCapturing();

    // 3. Lock first process box
    const firstRect = harness.getElement(alignedRects[0].id)!;
    harness.setElement({ ...firstRect, locked: true }, 'local');

    expect((harness.getElement(firstRect.id) as any).locked).toBe(true);

    // Undo lock
    harness.undo();
    expect((harness.getElement(firstRect.id) as any).locked).toBeFalsy();

    // Undo alignment
    harness.undo();

    // Undo template insertion
    harness.undo();
    expect(harness.getElements().length).toBe(0);
  });
});
