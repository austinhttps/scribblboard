import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import {
  CanvasElement,
  RectElement,
  CircleElement,
  StickyElement,
  TextElement,
  ArrowElement,
  PenElement,
} from '../../src/types/whiteboard';

describe('Empirical Challenger M1-2: Adversarial Stress Test Suite for Grouping & Ungrouping', () => {
  let harness: YjsTestHarness;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    harness = new YjsTestHarness(505);
  });

  afterEach(() => {
    harness.cleanup();
  });

  // Helper recreating App.tsx handleGroupSelected logic
  const executeGroupSelected = (selectedElements: CanvasElement[]): string | null => {
    if (selectedElements.length < 2) return null;

    const newGroupId = crypto.randomUUID();
    const updatedElements: CanvasElement[] = selectedElements.map((el) => ({
      ...el,
      groupId: newGroupId,
      updatedAt: Date.now(),
    } as CanvasElement));

    harness.setElements(updatedElements, 'local');
    return newGroupId;
  };

  // Helper recreating App.tsx handleUngroupSelected logic
  const executeUngroupSelected = (
    allElements: CanvasElement[],
    selectedElements: CanvasElement[]
  ): CanvasElement[] => {
    if (selectedElements.length === 0) return [];

    const groupIdsToClear = new Set(
      selectedElements
        .map((el) => el.groupId)
        .filter((gid): gid is string => Boolean(gid))
    );

    if (groupIdsToClear.size === 0) return [];

    const elementsToUpdate = allElements
      .filter((el) => el.groupId && groupIdsToClear.has(el.groupId))
      .map((el) => {
        const clone = { ...el, updatedAt: Date.now() };
        delete clone.groupId;
        return clone as CanvasElement;
      });

    if (elementsToUpdate.length > 0) {
      harness.setElements(elementsToUpdate, 'local');
    }

    return elementsToUpdate;
  };

  // Helper recreating Whiteboard.tsx handleSelectElement expansion logic
  const executeExpandSelection = (
    targetId: string,
    currentSelectedIds: string[],
    allElements: CanvasElement[],
    isShiftOrMeta: boolean
  ): string[] => {
    const targetEl = allElements.find((el) => el.id === targetId);
    if (!targetEl) return currentSelectedIds;

    const groupMemberIds = targetEl.groupId
      ? allElements.filter((el) => el.groupId === targetEl.groupId).map((el) => el.id)
      : [targetId];

    if (isShiftOrMeta) {
      const hasAll = groupMemberIds.every((mId) => currentSelectedIds.includes(mId));
      return hasAll
        ? currentSelectedIds.filter((item) => !groupMemberIds.includes(item))
        : Array.from(new Set([...currentSelectedIds, ...groupMemberIds]));
    } else {
      return currentSelectedIds.includes(targetId) && currentSelectedIds.length > 1
        ? currentSelectedIds
        : groupMemberIds;
    }
  };

  // Helper recreating Whiteboard.tsx handleElementDragEnd batch commit logic
  const executeGroupDrag = (
    draggingLeaderId: string,
    dx: number,
    dy: number,
    allElements: CanvasElement[],
    selectedIds: string[]
  ): CanvasElement[] => {
    const leader = allElements.find((el) => el.id === draggingLeaderId);
    if (!leader || leader.locked) return [];

    let draggingIds = selectedIds.includes(draggingLeaderId) ? [...selectedIds] : [draggingLeaderId];
    if (leader.groupId && !selectedIds.includes(draggingLeaderId)) {
      draggingIds = allElements.filter((el) => el.groupId === leader.groupId).map((el) => el.id);
    }

    // Expand group members for ALL elements participating in the drag
    const groupIdsInDrag = new Set<string>();
    draggingIds.forEach((elId) => {
      const el = allElements.find((item) => item.id === elId);
      if (el?.groupId) groupIdsInDrag.add(el.groupId);
    });
    if (groupIdsInDrag.size > 0) {
      const allGroupMemberIds = allElements
        .filter((el) => el.groupId && groupIdsInDrag.has(el.groupId))
        .map((el) => el.id);
      draggingIds = Array.from(new Set([...draggingIds, ...allGroupMemberIds]));
    }

    // If ANY participating element is locked, cancel drag immediately
    const hasLocked = draggingIds.some((elId) => {
      const el = allElements.find((item) => item.id === elId);
      return el?.locked === true;
    });
    if (hasLocked) return [];

    if (dx === 0 && dy === 0) return [];

    const updatedElements: CanvasElement[] = [];

    draggingIds.forEach((elId) => {
      const el = allElements.find((item) => item.id === elId);
      if (!el || el.locked) return;

      if (el.type === 'pen' || el.type === 'arrow' || el.type === 'line') {
        const pts = (el as any).points || [];
        const updatedPoints = pts.map((p: number, i: number) => (i % 2 === 0 ? p + dx : p + dy));
        updatedElements.push({
          ...el,
          points: updatedPoints,
          updatedAt: Date.now(),
        } as CanvasElement);
      } else {
        updatedElements.push({
          ...el,
          x: el.x + dx,
          y: el.y + dy,
          updatedAt: Date.now(),
        } as CanvasElement);
      }
    });

    if (updatedElements.length > 0) {
      harness.setElements(updatedElements, 'local');
    }

    return updatedElements;
  };

  // =========================================================================
  // REQUIREMENT 1: Grouping 2+ elements with valid UUID groupId in single tx
  // =========================================================================
  describe('Requirement 1: Grouping 2+ elements', () => {
    it('CHALLENGE-GRP-1.1: should assign the exact same valid UUID groupId to 2 elements in a single transaction', () => {
      const el1: RectElement = {
        id: 'rect-1',
        type: 'rect',
        x: 10,
        y: 20,
        width: 100,
        height: 60,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        zIndex: 1,
        updatedAt: 1000,
      };
      const el2: CircleElement = {
        id: 'circle-1',
        type: 'circle',
        x: 200,
        y: 150,
        radiusX: 50,
        radiusY: 50,
        fill: '#fef08a',
        stroke: '#000000',
        strokeWidth: 2,
        zIndex: 2,
        updatedAt: 1000,
      };
      harness.setElements([el1, el2], 'remote');
      harness.undoManager.stopCapturing();

      // Track transactions
      let transactionCount = 0;
      const txListener = () => {
        transactionCount++;
      };
      harness.doc.on('afterTransaction', txListener);

      const assignedGroupId = executeGroupSelected([el1, el2]);

      harness.doc.off('afterTransaction', txListener);

      expect(assignedGroupId).not.toBeNull();
      expect(assignedGroupId).toMatch(UUID_REGEX);
      expect(transactionCount).toBe(1);

      const stored1 = harness.getElement('rect-1')!;
      const stored2 = harness.getElement('circle-1')!;
      expect(stored1.groupId).toBe(assignedGroupId);
      expect(stored2.groupId).toBe(assignedGroupId);
    });

    it('CHALLENGE-GRP-1.2: should group N=20 diverse elements atomically with identical groupId', () => {
      const elements: CanvasElement[] = [];
      for (let i = 0; i < 20; i++) {
        elements.push({
          id: `item-${i}`,
          type: 'rect',
          x: i * 20,
          y: i * 30,
          width: 50,
          height: 50,
          fill: '#3b82f6',
          stroke: '#1e3a8a',
          strokeWidth: 1,
          zIndex: i,
          updatedAt: 1000,
        } as CanvasElement);
      }
      harness.setElements(elements, 'remote');
      harness.undoManager.stopCapturing();

      let transactionCount = 0;
      const txListener = () => transactionCount++;
      harness.doc.on('afterTransaction', txListener);

      const newGroupId = executeGroupSelected(elements);

      harness.doc.off('afterTransaction', txListener);

      expect(newGroupId).toMatch(UUID_REGEX);
      expect(transactionCount).toBe(1);

      const retrieved = harness.getElements();
      expect(retrieved.length).toBe(20);
      for (const el of retrieved) {
        expect(el.groupId).toBe(newGroupId);
      }
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Attempting to group < 2 elements is rejected / no-op
  // =========================================================================
  describe('Requirement 2: Grouping <2 elements rejection', () => {
    it('CHALLENGE-GRP-2.1: grouping 0 elements returns null and performs zero mutations', () => {
      let transactionCount = 0;
      const txListener = () => transactionCount++;
      harness.doc.on('afterTransaction', txListener);

      const result = executeGroupSelected([]);

      harness.doc.off('afterTransaction', txListener);

      expect(result).toBeNull();
      expect(transactionCount).toBe(0);
      expect(harness.getElements().length).toBe(0);
    });

    it('CHALLENGE-GRP-2.2: grouping exactly 1 element returns null and does NOT assign a groupId', () => {
      const single: TextElement = {
        id: 'text-single',
        type: 'text',
        x: 100,
        y: 100,
        text: 'Solo Element',
        fontSize: 16,
        fontFamily: 'Inter',
        fill: '#000000',
        zIndex: 1,
        updatedAt: 1000,
      };
      harness.setElement(single, 'remote');
      harness.undoManager.stopCapturing();

      let transactionCount = 0;
      const txListener = () => transactionCount++;
      harness.doc.on('afterTransaction', txListener);

      const result = executeGroupSelected([single]);

      harness.doc.off('afterTransaction', txListener);

      expect(result).toBeNull();
      expect(transactionCount).toBe(0);
      const retrieved = harness.getElement('text-single')!;
      expect(retrieved.groupId).toBeUndefined();
    });

    it('CHALLENGE-GRP-2.3: grouping 1 element that already had a groupId does not overwrite or remove it', () => {
      const preGrouped: RectElement = {
        id: 'pre-grouped',
        type: 'rect',
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        fill: '#ef4444',
        stroke: '#b91c1c',
        strokeWidth: 1,
        zIndex: 1,
        updatedAt: 1000,
        groupId: 'existing-gid-123',
      };
      harness.setElement(preGrouped, 'remote');

      const result = executeGroupSelected([preGrouped]);
      expect(result).toBeNull();
      expect(harness.getElement('pre-grouped')!.groupId).toBe('existing-gid-123');
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Group Selection Expansion
  // =========================================================================
  describe('Requirement 3: Group selection expansion', () => {
    const gId = 'test-group-expansion';
    const el1 = { id: 'exp-1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: gId } as CanvasElement;
    const el2 = { id: 'exp-2', type: 'rect', x: 50, y: 0, zIndex: 2, updatedAt: 1, groupId: gId } as CanvasElement;
    const el3 = { id: 'exp-3', type: 'rect', x: 100, y: 0, zIndex: 3, updatedAt: 1, groupId: gId } as CanvasElement;
    const elSolo = { id: 'exp-solo', type: 'rect', x: 200, y: 0, zIndex: 4, updatedAt: 1 } as CanvasElement;

    beforeEach(() => {
      harness.setElements([el1, el2, el3, elSolo]);
    });

    it('CHALLENGE-GRP-3.1: clicking a single member of a group expands selection to all group members', () => {
      const all = harness.getElements();
      const selection = executeExpandSelection('exp-2', [], all, false);

      expect(selection).toHaveLength(3);
      expect(selection).toContain('exp-1');
      expect(selection).toContain('exp-2');
      expect(selection).toContain('exp-3');
      expect(selection).not.toContain('exp-solo');
    });

    it('CHALLENGE-GRP-3.2: clicking on an ungrouped element selects only that element', () => {
      const all = harness.getElements();
      const selection = executeExpandSelection('exp-solo', ['exp-1', 'exp-2', 'exp-3'], all, false);

      expect(selection).toEqual(['exp-solo']);
    });

    it('CHALLENGE-GRP-3.3: clicking an already selected group member preserves the multi-selection', () => {
      const all = harness.getElements();
      // Already selected exp-1, exp-2, exp-3
      const currentSelection = ['exp-1', 'exp-2', 'exp-3'];
      const result = executeExpandSelection('exp-1', currentSelection, all, false);

      expect(result).toEqual(['exp-1', 'exp-2', 'exp-3']);
    });

    it('CHALLENGE-GRP-3.4: shift-clicking a group toggles all members in and out atomically', () => {
      const all = harness.getElements();

      // Shift-click exp-1 when solo element is currently selected: adds entire group
      const withGroup = executeExpandSelection('exp-1', ['exp-solo'], all, true);
      expect(withGroup).toHaveLength(4);
      expect(withGroup).toContain('exp-solo');
      expect(withGroup).toContain('exp-1');
      expect(withGroup).toContain('exp-2');
      expect(withGroup).toContain('exp-3');

      // Shift-click exp-2 when group is already selected: removes entire group
      const afterDeselect = executeExpandSelection('exp-2', withGroup, all, true);
      expect(afterDeselect).toEqual(['exp-solo']);
    });

    it('CHALLENGE-GRP-3.5: marquee box intersecting 1 group member expands to all group members', () => {
      const all = harness.getElements();

      // Simulate marquee box covering bounds of exp-1 only
      // Box x: -10..20, y: -10..20 (overlaps exp-1 only)
      const isOverlapping = (id: string) => id === 'exp-1';

      const expandedIds = new Set<string>();
      all.forEach((el) => {
        if (isOverlapping(el.id)) {
          if (el.groupId) {
            all.filter((e) => e.groupId === el.groupId).forEach((m) => expandedIds.add(m.id));
          } else {
            expandedIds.add(el.id);
          }
        }
      });

      const selected = Array.from(expandedIds);
      expect(selected).toHaveLength(3);
      expect(selected).toContain('exp-1');
      expect(selected).toContain('exp-2');
      expect(selected).toContain('exp-3');
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Atomic group movement across multiple element types
  // =========================================================================
  describe('Requirement 4: Atomic group movement', () => {
    it('CHALLENGE-GRP-4.1: moving group shifts all members (rect, sticky, text, arrow, pen) in a single Yjs transaction', () => {
      const gId = 'heterogeneous-group';

      const rect: RectElement = {
        id: 'h-rect',
        type: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 60,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        zIndex: 1,
        updatedAt: 1000,
        groupId: gId,
      };

      const sticky: StickyElement = {
        id: 'h-sticky',
        type: 'sticky',
        x: 250,
        y: 100,
        width: 150,
        height: 150,
        text: 'Notes',
        color: 'yellow',
        fontSize: 16,
        zIndex: 2,
        updatedAt: 1000,
        groupId: gId,
      };

      const pen: PenElement = {
        id: 'h-pen',
        type: 'pen',
        x: 0,
        y: 0,
        points: [50, 50, 60, 70, 80, 90],
        stroke: '#ff0000',
        strokeWidth: 3,
        zIndex: 3,
        updatedAt: 1000,
        groupId: gId,
      };

      const arrow: ArrowElement = {
        id: 'h-arrow',
        type: 'arrow',
        x: 0,
        y: 0,
        points: [100, 100, 200, 200],
        stroke: '#0000ff',
        strokeWidth: 2,
        zIndex: 4,
        updatedAt: 1000,
        groupId: gId,
      };

      harness.setElements([rect, sticky, pen, arrow], 'remote');
      harness.undoManager.stopCapturing();

      const all = harness.getElements();
      const selected = ['h-rect', 'h-sticky', 'h-pen', 'h-arrow'];

      let transactionCount = 0;
      const txListener = () => transactionCount++;
      harness.doc.on('afterTransaction', txListener);

      // Drag by dx: 35, dy: -25
      const moved = executeGroupDrag('h-rect', 35, -25, all, selected);

      harness.doc.off('afterTransaction', txListener);

      expect(moved).toHaveLength(4);
      expect(transactionCount).toBe(1);

      const r = harness.getElement('h-rect') as RectElement;
      const s = harness.getElement('h-sticky') as StickyElement;
      const p = harness.getElement('h-pen') as PenElement;
      const a = harness.getElement('h-arrow') as ArrowElement;

      expect(r.x).toBe(135);
      expect(r.y).toBe(75);

      expect(s.x).toBe(285);
      expect(s.y).toBe(75);

      expect(p.points).toEqual([85, 25, 95, 45, 115, 65]);
      expect(a.points).toEqual([135, 75, 235, 175]);
    });

    it('CHALLENGE-GRP-4.2: moving with zero delta is a safe no-op and does not trigger transactions', () => {
      const gId = 'zero-delta-group';
      const el1 = { id: 'zd-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: gId } as CanvasElement;
      const el2 = { id: 'zd-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: gId } as CanvasElement;
      harness.setElements([el1, el2], 'remote');

      let transactionCount = 0;
      const txListener = () => transactionCount++;
      harness.doc.on('afterTransaction', txListener);

      const moved = executeGroupDrag('zd-1', 0, 0, harness.getElements(), ['zd-1', 'zd-2']);

      harness.doc.off('afterTransaction', txListener);

      expect(moved).toHaveLength(0);
      expect(transactionCount).toBe(0);
    });

    it('CHALLENGE-GRP-4.3: moving group when one member is locked aborts drag and leaves all items in position', () => {
      const gId = 'locked-companion-group';
      const el1 = { id: 'lc-unlocked', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: gId } as CanvasElement;
      const el2 = { id: 'lc-locked', type: 'rect', x: 50, y: 50, zIndex: 2, updatedAt: 1, groupId: gId, locked: true } as CanvasElement;
      harness.setElements([el1, el2], 'remote');

      const moved = executeGroupDrag('lc-unlocked', 40, 30, harness.getElements(), ['lc-unlocked', 'lc-locked']);

      expect(moved).toHaveLength(0);
      // Both elements remain untouched in their original positions (no fracturing)
      expect(harness.getElement('lc-unlocked')!.x).toBe(10);
      expect(harness.getElement('lc-unlocked')!.y).toBe(10);
      expect(harness.getElement('lc-locked')!.x).toBe(50);
      expect(harness.getElement('lc-locked')!.y).toBe(50);
    });
  });

  // =========================================================================
  // REQUIREMENT 5: Undo / Redo Single-Step Atomicity
  // =========================================================================
  describe('Requirement 5: Undo/Redo Single-Step Atomicity', () => {
    it('CHALLENGE-GRP-5.1: undo() reverts all group members positions simultaneously in ONE single undo step', () => {
      const gId = 'undo-move-group';
      const m1 = { id: 'um-1', type: 'rect', x: 10, y: 20, zIndex: 1, updatedAt: 10, groupId: gId } as CanvasElement;
      const m2 = { id: 'um-2', type: 'rect', x: 100, y: 200, zIndex: 2, updatedAt: 10, groupId: gId } as CanvasElement;
      const m3 = { id: 'um-3', type: 'rect', x: 300, y: 400, zIndex: 3, updatedAt: 10, groupId: gId } as CanvasElement;

      // Seed baseline state outside undo manager tracking
      harness.setElements([m1, m2, m3], 'remote');
      harness.undoManager.stopCapturing();

      // Execute group move in local origin
      executeGroupDrag('um-1', 50, 75, harness.getElements(), ['um-1', 'um-2', 'um-3']);

      // Verify moved coordinates
      expect(harness.getElement('um-1')!.x).toBe(60);
      expect(harness.getElement('um-1')!.y).toBe(95);
      expect(harness.getElement('um-2')!.x).toBe(150);
      expect(harness.getElement('um-2')!.y).toBe(275);
      expect(harness.getElement('um-3')!.x).toBe(350);
      expect(harness.getElement('um-3')!.y).toBe(475);

      expect(harness.undoManager.undoStack.length).toBe(1);

      // Perform SINGLE undo
      const undoSuccess = harness.undo();
      expect(undoSuccess).toBe(true);

      // ALL 3 elements must be back to initial coordinates after ONE undo step
      expect(harness.getElement('um-1')!.x).toBe(10);
      expect(harness.getElement('um-1')!.y).toBe(20);
      expect(harness.getElement('um-2')!.x).toBe(100);
      expect(harness.getElement('um-2')!.y).toBe(200);
      expect(harness.getElement('um-3')!.x).toBe(300);
      expect(harness.getElement('um-3')!.y).toBe(400);

      // Undo stack must now be empty
      expect(harness.undoManager.undoStack.length).toBe(0);

      // Redo restores all 3 in ONE single step
      const redoSuccess = harness.redo();
      expect(redoSuccess).toBe(true);
      expect(harness.getElement('um-1')!.x).toBe(60);
      expect(harness.getElement('um-2')!.x).toBe(150);
      expect(harness.getElement('um-3')!.x).toBe(350);
    });

    it('CHALLENGE-GRP-5.2: undo() reverts grouping operation across all elements in ONE single step', () => {
      const el1 = { id: 'ug-el1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1 } as CanvasElement;
      const el2 = { id: 'ug-el2', type: 'rect', x: 10, y: 10, zIndex: 2, updatedAt: 1 } as CanvasElement;
      const el3 = { id: 'ug-el3', type: 'rect', x: 20, y: 20, zIndex: 3, updatedAt: 1 } as CanvasElement;
      harness.setElements([el1, el2, el3], 'remote');
      harness.undoManager.stopCapturing();

      // Perform group
      const newGroupId = executeGroupSelected([el1, el2, el3]);
      expect(harness.getElement('ug-el1')!.groupId).toBe(newGroupId);
      expect(harness.getElement('ug-el2')!.groupId).toBe(newGroupId);
      expect(harness.getElement('ug-el3')!.groupId).toBe(newGroupId);
      expect(harness.undoManager.undoStack.length).toBe(1);

      // Single undo reverts all
      harness.undo();
      expect(harness.getElement('ug-el1')!.groupId).toBeUndefined();
      expect(harness.getElement('ug-el2')!.groupId).toBeUndefined();
      expect(harness.getElement('ug-el3')!.groupId).toBeUndefined();
      expect(harness.undoManager.undoStack.length).toBe(0);
    });
  });

  // =========================================================================
  // REQUIREMENT 6: Ungrouping cleanly clears groupId
  // =========================================================================
  describe('Requirement 6: Ungrouping', () => {
    it('CHALLENGE-GRP-6.1: ungrouping cleanly clears groupId across all members', () => {
      const gId = 'clean-ungroup-id';
      const el1 = { id: 'cu-1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: gId } as CanvasElement;
      const el2 = { id: 'cu-2', type: 'rect', x: 10, y: 10, zIndex: 2, updatedAt: 1, groupId: gId } as CanvasElement;
      harness.setElements([el1, el2], 'remote');
      harness.undoManager.stopCapturing();

      const updated = executeUngroupSelected(harness.getElements(), [el1, el2]);
      expect(updated).toHaveLength(2);

      const r1 = harness.getElement('cu-1')!;
      const r2 = harness.getElement('cu-2')!;
      expect(r1.groupId).toBeUndefined();
      expect(r2.groupId).toBeUndefined();
      expect('groupId' in r1).toBe(false);
      expect('groupId' in r2).toBe(false);
    });

    it('CHALLENGE-GRP-6.2: ungrouping when only 1 member of group is selected ungroups the entire group', () => {
      const gId = 'partial-select-group';
      const el1 = { id: 'ps-1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: gId } as CanvasElement;
      const el2 = { id: 'ps-2', type: 'rect', x: 10, y: 10, zIndex: 2, updatedAt: 1, groupId: gId } as CanvasElement;
      const el3 = { id: 'ps-3', type: 'rect', x: 20, y: 20, zIndex: 3, updatedAt: 1, groupId: gId } as CanvasElement;
      harness.setElements([el1, el2, el3], 'remote');

      // Only ps-2 is passed in selection
      const updated = executeUngroupSelected(harness.getElements(), [el2]);
      expect(updated).toHaveLength(3);

      expect(harness.getElement('ps-1')!.groupId).toBeUndefined();
      expect(harness.getElement('ps-2')!.groupId).toBeUndefined();
      expect(harness.getElement('ps-3')!.groupId).toBeUndefined();
    });

    it('CHALLENGE-GRP-6.3: ungrouping non-grouped elements is a safe no-op', () => {
      const solo = { id: 'no-grp', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1 } as CanvasElement;
      harness.setElement(solo, 'remote');

      let transactionCount = 0;
      const txListener = () => transactionCount++;
      harness.doc.on('afterTransaction', txListener);

      const result = executeUngroupSelected(harness.getElements(), [solo]);

      harness.doc.off('afterTransaction', txListener);

      expect(result).toHaveLength(0);
      expect(transactionCount).toBe(0);
      expect(harness.getElement('no-grp')!.groupId).toBeUndefined();
    });
  });

  // =========================================================================
  // REQUIREMENT 7: Mixed groups
  // =========================================================================
  describe('Requirement 7: Mixed groups', () => {
    it('CHALLENGE-GRP-7.1: selecting items from 2 different groups and ungrouping must clear both groups cleanly', () => {
      const g1 = 'alpha-group';
      const g2 = 'beta-group';

      const a1 = { id: 'a1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: g1 } as CanvasElement;
      const a2 = { id: 'a2', type: 'rect', x: 10, y: 10, zIndex: 2, updatedAt: 1, groupId: g1 } as CanvasElement;
      const b1 = { id: 'b1', type: 'rect', x: 100, y: 100, zIndex: 3, updatedAt: 1, groupId: g2 } as CanvasElement;
      const b2 = { id: 'b2', type: 'rect', x: 110, y: 110, zIndex: 4, updatedAt: 1, groupId: g2 } as CanvasElement;
      const solo = { id: 'solo', type: 'rect', x: 500, y: 500, zIndex: 5, updatedAt: 1 } as CanvasElement;

      harness.setElements([a1, a2, b1, b2, solo], 'remote');
      harness.undoManager.stopCapturing();

      // User selects a1 (from group 1) and b1 (from group 2)
      const selected = [a1, b1];
      const all = harness.getElements();

      let transactionCount = 0;
      const txListener = () => transactionCount++;
      harness.doc.on('afterTransaction', txListener);

      const updated = executeUngroupSelected(all, selected);

      harness.doc.off('afterTransaction', txListener);

      expect(transactionCount).toBe(1);
      expect(updated).toHaveLength(4);

      // Both groups completely cleared
      expect(harness.getElement('a1')!.groupId).toBeUndefined();
      expect(harness.getElement('a2')!.groupId).toBeUndefined();
      expect(harness.getElement('b1')!.groupId).toBeUndefined();
      expect(harness.getElement('b2')!.groupId).toBeUndefined();

      // Solo element completely untouched
      expect(harness.getElement('solo')!.groupId).toBeUndefined();

      // Single undo restores both groups with their respective original groupIds
      expect(harness.undoManager.undoStack.length).toBe(1);
      harness.undo();

      expect(harness.getElement('a1')!.groupId).toBe(g1);
      expect(harness.getElement('a2')!.groupId).toBe(g1);
      expect(harness.getElement('b1')!.groupId).toBe(g2);
      expect(harness.getElement('b2')!.groupId).toBe(g2);
    });

    it('CHALLENGE-GRP-7.2: selecting items from 2 different groups and grouping merges them into 1 new group', () => {
      const g1 = 'group-1';
      const g2 = 'group-2';

      const a1 = { id: 'm-a1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: g1 } as CanvasElement;
      const a2 = { id: 'm-a2', type: 'rect', x: 10, y: 10, zIndex: 2, updatedAt: 1, groupId: g1 } as CanvasElement;
      const b1 = { id: 'm-b1', type: 'rect', x: 20, y: 20, zIndex: 3, updatedAt: 1, groupId: g2 } as CanvasElement;
      const b2 = { id: 'm-b2', type: 'rect', x: 30, y: 30, zIndex: 4, updatedAt: 1, groupId: g2 } as CanvasElement;

      harness.setElements([a1, a2, b1, b2], 'remote');
      harness.undoManager.stopCapturing();

      // Group all 4
      const mergedGid = executeGroupSelected([a1, a2, b1, b2]);
      expect(mergedGid).toMatch(UUID_REGEX);
      expect(mergedGid).not.toBe(g1);
      expect(mergedGid).not.toBe(g2);

      expect(harness.getElement('m-a1')!.groupId).toBe(mergedGid);
      expect(harness.getElement('m-a2')!.groupId).toBe(mergedGid);
      expect(harness.getElement('m-b1')!.groupId).toBe(mergedGid);
      expect(harness.getElement('m-b2')!.groupId).toBe(mergedGid);

      // Single undo reverts them back to their two distinct separate groups
      harness.undo();
      expect(harness.getElement('m-a1')!.groupId).toBe(g1);
      expect(harness.getElement('m-a2')!.groupId).toBe(g1);
      expect(harness.getElement('m-b1')!.groupId).toBe(g2);
      expect(harness.getElement('m-b2')!.groupId).toBe(g2);
    });
  });

  // =========================================================================
  // STRESS TEST: Massive group with 100 elements under rapid churn
  // =========================================================================
  describe('Adversarial Stress: 100-Element Group', () => {
    it('CHALLENGE-GRP-STRESS: 100-element group creation, translation, undo, redo, and ungrouping under stress', () => {
      const items: CanvasElement[] = [];
      for (let i = 0; i < 100; i++) {
        items.push({
          id: `stress-${i}`,
          type: 'rect',
          x: i * 10,
          y: i * 5,
          width: 40,
          height: 30,
          fill: '#10b981',
          stroke: '#047857',
          strokeWidth: 1,
          zIndex: i,
          updatedAt: 1000,
        } as CanvasElement);
      }
      harness.setElements(items, 'remote');
      harness.undoManager.stopCapturing();

      // Step 1: Group 100 elements
      const stressGid = executeGroupSelected(items);
      expect(stressGid).toMatch(UUID_REGEX);
      expect(harness.undoManager.undoStack.length).toBe(1);
      harness.undoManager.stopCapturing();

      // Step 2: Drag 100 elements by (dx: 250.5, dy: -120.75)
      const all = harness.getElements();
      const selectedIds = items.map((i) => i.id);
      const moved = executeGroupDrag('stress-0', 250.5, -120.75, all, selectedIds);
      expect(moved).toHaveLength(100);
      expect(harness.undoManager.undoStack.length).toBe(2);

      expect(harness.getElement('stress-0')!.x).toBe(250.5);
      expect(harness.getElement('stress-0')!.y).toBe(-120.75);
      expect(harness.getElement('stress-99')!.x).toBe(990 + 250.5);
      expect(harness.getElement('stress-99')!.y).toBe(495 - 120.75);

      // Step 3: Undo drag in single step
      harness.undo();
      expect(harness.getElement('stress-0')!.x).toBe(0);
      expect(harness.getElement('stress-0')!.y).toBe(0);
      expect(harness.getElement('stress-99')!.x).toBe(990);
      expect(harness.getElement('stress-99')!.y).toBe(495);
      expect(harness.getElement('stress-0')!.groupId).toBe(stressGid);

      // Step 4: Redo drag in single step
      harness.redo();
      expect(harness.getElement('stress-0')!.x).toBe(250.5);
      expect(harness.getElement('stress-99')!.x).toBe(990 + 250.5);

      // Step 5: Ungroup all 100 elements
      const ungrouped = executeUngroupSelected(harness.getElements(), [harness.getElement('stress-0')!]);
      expect(ungrouped).toHaveLength(100);
      for (let i = 0; i < 100; i++) {
        expect(harness.getElement(`stress-${i}`)!.groupId).toBeUndefined();
      }
    });
  });
});
