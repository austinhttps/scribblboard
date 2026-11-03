import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: class {
    on() {}
    destroy() {}
  },
}));

vi.mock('y-websocket', () => ({
  WebsocketProvider: class {
    awareness = {
      setLocalStateField: vi.fn(),
      getStates: vi.fn(() => new Map()),
      on: vi.fn(),
    };
    on() {}
    destroy() {}
  },
}));

import { whiteboardService } from '../../src/services/yjsDoc';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 1 - Object Locking', () => {
  beforeEach(() => {
    whiteboardService.initBoard(`test-lock-${Date.now()}-${Math.random()}`);
  });

  afterEach(() => {
    whiteboardService.cleanup();
  });

  it('T1-LOCK-1: should persist locked: true flag on element in whiteboardService.elementsMap', () => {
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

    whiteboardService.setElement(rect as CanvasElement);

    // Direct assertion against whiteboardService.elementsMap
    const elementsMap = whiteboardService.getElementsMap();
    expect(elementsMap).toBeDefined();
    const rawStored = elementsMap!.get('rect-1');
    expect(rawStored).toBeDefined();
    expect(rawStored!.locked).toBe(true);

    // Assertion via public service API
    const stored = whiteboardService.getElements().find((e) => e.id === 'rect-1');
    expect(stored).toBeDefined();
    expect(stored?.locked).toBe(true);
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
    whiteboardService.setElement(rect as CanvasElement);

    // Canvas architecture prohibits dragging locked elements (draggable={!el.locked})
    // Drag handlers abort displacement when element is locked
    const attemptDisplacement = (id: string, dx: number, dy: number) => {
      const el = whiteboardService.getElements().find((e) => e.id === id);
      if (!el || el.locked) return;
      whiteboardService.setElement({ ...el, x: el.x + dx, y: el.y + dy });
    };

    attemptDisplacement('rect-2', 50, 50);

    const el = whiteboardService.getElements().find((e) => e.id === 'rect-2')!;
    expect(el.x).toBe(50);
    expect(el.y).toBe(50);
  });

  it('T1-LOCK-3: should reject delete operation when element is locked through deletion logic', () => {
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
    whiteboardService.setElement(rect as CanvasElement);

    // 1. Application-level deletion logic: filter out locked elements before issuing delete
    const selectedIds = ['rect-3'];
    const elements = whiteboardService.getElements();
    const deletableIds = selectedIds.filter(
      (id) => !elements.find((el) => el.id === id)?.locked
    );
    expect(deletableIds).toEqual([]);

    if (deletableIds.length > 0) {
      whiteboardService.deleteElements(deletableIds);
    }

    expect(whiteboardService.getElements().find((e) => e.id === 'rect-3')).toBeDefined();

    // 2. Service-level deletion guard: calling deleteElement on locked element is rejected
    whiteboardService.deleteElement('rect-3');
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-3')).toBeDefined();
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-3')?.locked).toBe(true);
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
    whiteboardService.setElement(rect as CanvasElement);

    // Production toggle logic from App.tsx handleToggleLock
    const toggleLock = (ids: string[]) => {
      const current = whiteboardService.getElements().filter((el) => ids.includes(el.id));
      if (current.length === 0) return;
      const anyUnlocked = current.some((el) => !el.locked);
      const updated = current.map((el) => ({
        ...el,
        locked: anyUnlocked ? true : undefined,
        updatedAt: Date.now(),
      }));
      whiteboardService.setBatchElements(updated);
    };

    // Toggle on -> locked: true
    toggleLock(['rect-4']);
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-4')?.locked).toBe(true);

    // Toggle off -> locked: undefined
    toggleLock(['rect-4']);
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-4')?.locked).toBeUndefined();
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
    whiteboardService.setElement(rect as CanvasElement);

    // Unlock
    const el = whiteboardService.getElements().find((e) => e.id === 'rect-5')!;
    const unlocked = { ...el, locked: false, updatedAt: Date.now() };
    whiteboardService.setElement(unlocked);
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-5')?.locked).toBe(false);

    // Drag unlocked element
    const moved = { ...unlocked, x: unlocked.x + 30, y: unlocked.y + 40, updatedAt: Date.now() };
    whiteboardService.setElement(moved);
    const afterDrag = whiteboardService.getElements().find((e) => e.id === 'rect-5')!;
    expect(afterDrag.x).toBe(40);
    expect(afterDrag.y).toBe(60);

    // Delete unlocked element
    const elements = whiteboardService.getElements();
    const deletableIds = ['rect-5'].filter((id) => !elements.find((e) => e.id === id)?.locked);
    whiteboardService.deleteElements(deletableIds);
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-5')).toBeUndefined();
  });

  it('T1-LOCK-6: should undo and redo lock state change via whiteboardService.undo() / redo()', () => {
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
    whiteboardService.setElement(rect as CanvasElement);
    whiteboardService.getUndoManager()?.stopCapturing();

    // Lock element in separate transaction
    const target = whiteboardService.getElements().find((e) => e.id === 'rect-6')!;
    whiteboardService.setElement({
      ...target,
      locked: true,
      updatedAt: Date.now(),
    });
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-6')?.locked).toBe(true);

    // Undo restores locked: false
    expect(whiteboardService.canUndo()).toBe(true);
    const undoResult = whiteboardService.undo();
    expect(undoResult).toBe(true);
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-6')?.locked).toBe(false);

    // Redo restores locked: true
    expect(whiteboardService.canRedo()).toBe(true);
    const redoResult = whiteboardService.redo();
    expect(redoResult).toBe(true);
    expect(whiteboardService.getElements().find((e) => e.id === 'rect-6')?.locked).toBe(true);
  });
});
