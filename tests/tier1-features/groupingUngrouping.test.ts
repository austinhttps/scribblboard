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
import { CanvasElement, RectElement, CircleElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 2 - Grouping & Ungrouping', () => {
  beforeEach(() => {
    whiteboardService.initBoard(`test-grp-${Date.now()}-${Math.random()}`);
  });

  afterEach(() => {
    whiteboardService.cleanup();
  });

  it('T1-GRP-1: should assign shared groupId to selected elements in a single Yjs transaction via setBatchElements()', () => {
    const el1: RectElement = {
      id: 'grp-el-1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 100,
      height: 100,
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 1,
      zIndex: 1,
      updatedAt: Date.now(),
    };
    const el2: CircleElement = {
      id: 'grp-el-2',
      type: 'circle',
      x: 200,
      y: 200,
      radiusX: 40,
      radiusY: 40,
      fill: '#00ff00',
      stroke: '#000000',
      strokeWidth: 1,
      zIndex: 2,
      updatedAt: Date.now(),
    };
    whiteboardService.setBatchElements([el1 as CanvasElement, el2 as CanvasElement]);

    // Group elements with shared groupId in atomic transaction
    const newGroupId = 'group-uuid-1';
    const grouped = [
      { ...whiteboardService.getElements().find((e) => e.id === 'grp-el-1')!, groupId: newGroupId },
      { ...whiteboardService.getElements().find((e) => e.id === 'grp-el-2')!, groupId: newGroupId },
    ];
    whiteboardService.setBatchElements(grouped);

    const stored1 = whiteboardService.getElements().find((e) => e.id === 'grp-el-1');
    const stored2 = whiteboardService.getElements().find((e) => e.id === 'grp-el-2');
    expect(stored1?.groupId).toBe('group-uuid-1');
    expect(stored2?.groupId).toBe('group-uuid-1');

    // Verify elementsMap persistence directly
    const elementsMap = whiteboardService.getElementsMap();
    expect(elementsMap!.get('grp-el-1')?.groupId).toBe('group-uuid-1');
    expect(elementsMap!.get('grp-el-2')?.groupId).toBe('group-uuid-1');
  });

  it('T1-GRP-2: should expand selection to all elements sharing groupId when one is clicked', () => {
    const el1 = { id: 'g-1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: 'grp-A' } as CanvasElement;
    const el2 = { id: 'g-2', type: 'rect', x: 50, y: 50, zIndex: 2, updatedAt: 1, groupId: 'grp-A' } as CanvasElement;
    const el3 = { id: 'g-3', type: 'rect', x: 100, y: 100, zIndex: 3, updatedAt: 1 } as CanvasElement;
    whiteboardService.setBatchElements([el1, el2, el3]);

    // Production selection expansion logic from Whiteboard.tsx handleSelectElement
    const allElements = whiteboardService.getElements();
    const targetEl = allElements.find((e) => e.id === 'g-1')!;
    const expandedIds = targetEl.groupId
      ? allElements.filter((el) => el.groupId === targetEl.groupId).map((el) => el.id)
      : ['g-1'];

    expect(expandedIds).toContain('g-1');
    expect(expandedIds).toContain('g-2');
    expect(expandedIds).not.toContain('g-3');
    expect(expandedIds.length).toBe(2);
  });

  it('T1-GRP-3: should move all group members by equal offset atomically via setBatchElements()', () => {
    const el1 = { id: 'm-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: 'grp-M' } as CanvasElement;
    const el2 = { id: 'm-2', type: 'rect', x: 60, y: 80, zIndex: 2, updatedAt: 1, groupId: 'grp-M' } as CanvasElement;
    whiteboardService.setBatchElements([el1, el2]);

    const dx = 25;
    const dy = 30;
    const members = whiteboardService.getElements().filter((e) => e.groupId === 'grp-M');
    const shifted = members.map((m) => ({
      ...m,
      x: m.x + dx,
      y: m.y + dy,
      updatedAt: Date.now(),
    }));
    whiteboardService.setBatchElements(shifted);

    const m1 = whiteboardService.getElements().find((e) => e.id === 'm-1')!;
    const m2 = whiteboardService.getElements().find((e) => e.id === 'm-2')!;
    expect(m1.x).toBe(35);
    expect(m1.y).toBe(40);
    expect(m2.x).toBe(85);
    expect(m2.y).toBe(110);
  });

  it('T1-GRP-4: should delete all group members when any group member is deleted', () => {
    const el1 = { id: 'd-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: 'grp-D' } as CanvasElement;
    const el2 = { id: 'd-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: 'grp-D' } as CanvasElement;
    whiteboardService.setBatchElements([el1, el2]);

    const target = whiteboardService.getElements().find((e) => e.id === 'd-1')!;
    const groupMemberIds = target.groupId
      ? whiteboardService.getElements().filter((e) => e.groupId === target.groupId).map((e) => e.id)
      : ['d-1'];

    whiteboardService.deleteElements(groupMemberIds);

    expect(whiteboardService.getElements().find((e) => e.id === 'd-1')).toBeUndefined();
    expect(whiteboardService.getElements().find((e) => e.id === 'd-2')).toBeUndefined();
  });

  it('T1-GRP-5: should ungroup elements by clearing groupId in an atomic transaction via setBatchElements()', () => {
    const el1 = { id: 'u-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: 'grp-U' } as CanvasElement;
    const el2 = { id: 'u-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: 'grp-U' } as CanvasElement;
    whiteboardService.setBatchElements([el1, el2]);

    // Ungroup logic from App.tsx handleUngroupSelected
    const members = whiteboardService.getElements().filter((e) => e.groupId === 'grp-U');
    const ungrouped = members.map((m) => {
      const clone = { ...m, updatedAt: Date.now() };
      delete clone.groupId;
      return clone;
    });
    whiteboardService.setBatchElements(ungrouped);

    const u1 = whiteboardService.getElements().find((e) => e.id === 'u-1')!;
    const u2 = whiteboardService.getElements().find((e) => e.id === 'u-2')!;
    expect(u1.groupId).toBeUndefined();
    expect(u2.groupId).toBeUndefined();
  });

  it('T1-GRP-6: should undo group movement and grouping operations in a single undo step', () => {
    // Part A: Undo Grouping
    const el1 = { id: 'ug-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1 } as CanvasElement;
    const el2 = { id: 'ug-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1 } as CanvasElement;
    whiteboardService.setElements([el1, el2], 'remote');
    whiteboardService.getUndoManager()?.stopCapturing();

    // Group operation via local origin
    const grouped = [
      { ...whiteboardService.getElements().find((e) => e.id === 'ug-1')!, groupId: 'grp-undo' },
      { ...whiteboardService.getElements().find((e) => e.id === 'ug-2')!, groupId: 'grp-undo' },
    ];
    whiteboardService.setBatchElements(grouped, 'local');

    expect(whiteboardService.getElements().find((e) => e.id === 'ug-1')?.groupId).toBe('grp-undo');
    expect(whiteboardService.getElements().find((e) => e.id === 'ug-2')?.groupId).toBe('grp-undo');

    // Single undo reverts grouping for all group members simultaneously
    expect(whiteboardService.canUndo()).toBe(true);
    whiteboardService.undo();
    expect(whiteboardService.getElements().find((e) => e.id === 'ug-1')?.groupId).toBeUndefined();
    expect(whiteboardService.getElements().find((e) => e.id === 'ug-2')?.groupId).toBeUndefined();

    // Part B: Undo Group Movement
    const withGroup = [
      { ...whiteboardService.getElements().find((e) => e.id === 'ug-1')!, groupId: 'grp-move-test', x: 10, y: 10 },
      { ...whiteboardService.getElements().find((e) => e.id === 'ug-2')!, groupId: 'grp-move-test', x: 20, y: 20 },
    ];
    whiteboardService.setBatchElements(withGroup, 'remote');
    whiteboardService.getUndoManager()?.stopCapturing();

    // Move group members
    const moved = withGroup.map((m) => ({ ...m, x: m.x + 50, y: m.y + 50 }));
    whiteboardService.setBatchElements(moved, 'local');
    expect(whiteboardService.getElements().find((e) => e.id === 'ug-1')?.x).toBe(60);
    expect(whiteboardService.getElements().find((e) => e.id === 'ug-2')?.x).toBe(70);

    // Single undo reverts BOTH member positions simultaneously
    whiteboardService.undo();
    expect(whiteboardService.getElements().find((e) => e.id === 'ug-1')?.x).toBe(10);
    expect(whiteboardService.getElements().find((e) => e.id === 'ug-2')?.x).toBe(20);
  });
});
