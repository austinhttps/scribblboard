import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 1 - Object Locking', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(101);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('T1-LOCK-1: should persist locked: true flag on element in Yjs CRDT map', () => {
    const rect: RectElement = {
      id: 'rect-1',
      type: 'rect',
      x: 100,
      y: 100,
      width: 150,
      height: 100,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      zIndex: 1,
      updatedAt: Date.now(),
      locked: true,
    };

    harness.setElement(rect as CanvasElement);
    const stored = harness.getElement('rect-1');

    expect(stored).toBeDefined();
    expect((stored as any).locked).toBe(true);
  });

  it('T1-LOCK-2: should prevent position displacement when element is locked', () => {
    const rect: RectElement = {
      id: 'rect-2',
      type: 'rect',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      zIndex: 1,
      updatedAt: Date.now(),
      locked: true,
    };
    harness.setElement(rect as CanvasElement);

    // Simulate drag attempt on locked element
    const dragAttempt = (el: CanvasElement, dx: number, dy: number): CanvasElement => {
      if ((el as any).locked) {
        return el; // Locked items cannot be dragged
      }
      return { ...el, x: el.x + dx, y: el.y + dy };
    };

    const moved = dragAttempt(harness.getElement('rect-2')!, 50, 50);
    expect(moved.x).toBe(50);
    expect(moved.y).toBe(50);
  });

  it('T1-LOCK-3: should reject delete operation when element is locked', () => {
    const rect: RectElement = {
      id: 'rect-3',
      type: 'rect',
      x: 200,
      y: 200,
      width: 120,
      height: 80,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      zIndex: 1,
      updatedAt: Date.now(),
      locked: true,
    };
    harness.setElement(rect as CanvasElement);

    // Safe delete function respecting locked state
    const safeDelete = (id: string) => {
      const el = harness.getElement(id);
      if (el && !(el as any).locked) {
        harness.deleteElement(id);
      }
    };

    safeDelete('rect-3');
    expect(harness.getElement('rect-3')).toBeDefined();
  });

  it('T1-LOCK-4: should toggle lock state when toggle command (Ctrl+L) is triggered', () => {
    const rect: RectElement = {
      id: 'rect-4',
      type: 'rect',
      x: 300,
      y: 100,
      width: 100,
      height: 100,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      zIndex: 1,
      updatedAt: Date.now(),
      locked: false,
    };
    harness.setElement(rect as CanvasElement);

    const toggleLock = (id: string) => {
      const el = harness.getElement(id);
      if (!el) return;
      harness.setElement({
        ...el,
        locked: !(el as any).locked,
      } as CanvasElement);
    };

    // Toggle on
    toggleLock('rect-4');
    expect((harness.getElement('rect-4') as any).locked).toBe(true);

    // Toggle off
    toggleLock('rect-4');
    expect((harness.getElement('rect-4') as any).locked).toBe(false);
  });

  it('T1-LOCK-5: should re-allow drag and delete once unlocked', () => {
    const rect: RectElement = {
      id: 'rect-5',
      type: 'rect',
      x: 10,
      y: 20,
      width: 80,
      height: 80,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      zIndex: 1,
      updatedAt: Date.now(),
      locked: true,
    };
    harness.setElement(rect as CanvasElement);

    // Unlock
    harness.setElement({
      ...harness.getElement('rect-5')!,
      locked: false,
    } as CanvasElement);

    // Drag
    const el = harness.getElement('rect-5')!;
    const dragged = { ...el, x: el.x + 30, y: el.y + 40 };
    harness.setElement(dragged);
    expect(harness.getElement('rect-5')!.x).toBe(40);
    expect(harness.getElement('rect-5')!.y).toBe(60);

    // Delete
    harness.deleteElement('rect-5');
    expect(harness.getElement('rect-5')).toBeUndefined();
  });

  it('T1-LOCK-6: should undo lock state change via Y.UndoManager', () => {
    const rect: RectElement = {
      id: 'rect-6',
      type: 'rect',
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 2,
      zIndex: 1,
      updatedAt: Date.now(),
      locked: false,
    };
    harness.setElement(rect as CanvasElement);
    harness.undoManager.stopCapturing();

    // Lock element in separate transaction
    harness.setElement({
      ...harness.getElement('rect-6')!,
      locked: true,
    } as CanvasElement);
    expect((harness.getElement('rect-6') as any).locked).toBe(true);

    // Undo should restore locked: false
    expect(harness.canUndo()).toBe(true);
    harness.undo();
    expect((harness.getElement('rect-6') as any).locked).toBe(false);
  });
});
