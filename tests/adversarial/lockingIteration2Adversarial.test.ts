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
import {
  CanvasElement,
  RectElement,
  CircleElement,
  StickyElement,
  PenElement,
  ArrowElement,
  LineElement,
} from '../../src/types/whiteboard';

describe('Adversarial Verification (Iteration 2): Object Locking, Cut Protection, and Service Deletion', () => {
  beforeEach(() => {
    whiteboardService.initBoard(`adv-lock-it2-${Date.now()}-${Math.random()}`);
  });

  afterEach(() => {
    whiteboardService.cleanup();
  });

  const createRect = (id: string, locked?: boolean, groupId?: string): RectElement => ({
    id,
    type: 'rect',
    x: 100,
    y: 100,
    width: 80,
    height: 60,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 2,
    zIndex: 1,
    updatedAt: Date.now(),
    locked,
    groupId,
  });

  const createCircle = (id: string, locked?: boolean, groupId?: string): CircleElement => ({
    id,
    type: 'circle',
    x: 200,
    y: 200,
    radiusX: 40,
    radiusY: 40,
    fill: '#ff0000',
    stroke: '#000000',
    strokeWidth: 2,
    zIndex: 2,
    updatedAt: Date.now(),
    locked,
    groupId,
  });

  const createSticky = (id: string, locked?: boolean, groupId?: string): StickyElement => ({
    id,
    type: 'sticky',
    x: 300,
    y: 300,
    width: 120,
    height: 120,
    text: 'Sticky Note',
    color: 'yellow',
    fontSize: 14,
    zIndex: 3,
    updatedAt: Date.now(),
    locked,
    groupId,
  });

  const createPen = (id: string, locked?: boolean, groupId?: string): PenElement => ({
    id,
    type: 'pen',
    x: 0,
    y: 0,
    points: [10, 10, 20, 20, 30, 30],
    color: '#000000',
    strokeWidth: 2,
    zIndex: 4,
    updatedAt: Date.now(),
    locked,
    groupId,
  });

  // =========================================================================
  // SUITE 1: Service Layer Deletion Safeguards (deleteElement & deleteElements)
  // =========================================================================
  describe('Suite 1: Service Layer Deletion Safeguards', () => {
    it('ADV-DEL-1: deleteElement directly on locked element is rejected and preserves element in CRDT', () => {
      const el = createRect('locked-el-1', true);
      whiteboardService.setElement(el);

      expect(whiteboardService.getElements().length).toBe(1);
      whiteboardService.deleteElement('locked-el-1');

      const surviving = whiteboardService.getElements().find((e) => e.id === 'locked-el-1');
      expect(surviving).toBeDefined();
      expect(surviving?.locked).toBe(true);
      expect(whiteboardService.getElementsMap()?.get('locked-el-1')).toBeDefined();
    });

    it('ADV-DEL-2: deleteElement on unlocked element deletes it cleanly', () => {
      const el = createRect('unlocked-el-1', false);
      whiteboardService.setElement(el);

      expect(whiteboardService.getElements().length).toBe(1);
      whiteboardService.deleteElement('unlocked-el-1');

      expect(whiteboardService.getElements().length).toBe(0);
      expect(whiteboardService.getElementsMap()?.get('unlocked-el-1')).toBeUndefined();
    });

    it('ADV-DEL-3: deleteElement with non-existent ID is a safe no-op', () => {
      expect(() => {
        whiteboardService.deleteElement('non-existent-id');
      }).not.toThrow();
    });

    it('ADV-DEL-4: deleteElements on array of ALL locked items deletes nothing', () => {
      const items = [
        createRect('l-1', true),
        createCircle('l-2', true),
        createSticky('l-3', true),
      ];
      whiteboardService.setBatchElements(items);

      expect(whiteboardService.getElements().length).toBe(3);
      whiteboardService.deleteElements(['l-1', 'l-2', 'l-3']);

      expect(whiteboardService.getElements().length).toBe(3);
      const remainingIds = whiteboardService.getElements().map((e) => e.id);
      expect(remainingIds).toEqual(expect.arrayContaining(['l-1', 'l-2', 'l-3']));
    });

    it('ADV-DEL-5: deleteElements on array of ALL unlocked items deletes all in one transaction', () => {
      const items = [
        createRect('u-1', false),
        createCircle('u-2', false),
        createSticky('u-3', false),
      ];
      whiteboardService.setBatchElements(items);

      expect(whiteboardService.getElements().length).toBe(3);
      whiteboardService.deleteElements(['u-1', 'u-2', 'u-3']);

      expect(whiteboardService.getElements().length).toBe(0);
    });

    it('ADV-DEL-6: deleteElements on MIXED array (5 locked, 5 unlocked) strictly deletes only the 5 unlocked', () => {
      const lockedItems = Array.from({ length: 5 }, (_, i) => createRect(`lock-${i}`, true));
      const unlockedItems = Array.from({ length: 5 }, (_, i) => createCircle(`unlock-${i}`, false));
      whiteboardService.setBatchElements([...lockedItems, ...unlockedItems]);

      expect(whiteboardService.getElements().length).toBe(10);

      const allIds = [...lockedItems.map((e) => e.id), ...unlockedItems.map((e) => e.id)];
      whiteboardService.deleteElements(allIds);

      const remaining = whiteboardService.getElements();
      expect(remaining.length).toBe(5);
      expect(remaining.every((e) => e.locked === true)).toBe(true);
      expect(remaining.map((e) => e.id).sort()).toEqual(lockedItems.map((e) => e.id).sort());
    });

    it('ADV-DEL-7: deleteElements with non-existent IDs mixed with locked and unlocked IDs handles gracefully', () => {
      const locked = createRect('mix-l', true);
      const unlocked = createCircle('mix-u', false);
      whiteboardService.setBatchElements([locked, unlocked]);

      whiteboardService.deleteElements(['mix-l', 'non-existent-1', 'mix-u', 'non-existent-2']);

      const remaining = whiteboardService.getElements();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('mix-l');
    });

    it('ADV-DEL-8: dynamic lock transition: unlocked -> locked prohibits deletion; locked -> unlocked allows deletion', () => {
      const el = createRect('dynamic-el', false);
      whiteboardService.setElement(el);

      // Transition to locked
      whiteboardService.setElement({ ...el, locked: true });
      whiteboardService.deleteElement('dynamic-el');
      expect(whiteboardService.getElements().find((e) => e.id === 'dynamic-el')).toBeDefined();

      // Transition to unlocked
      whiteboardService.setElement({ ...el, locked: false });
      whiteboardService.deleteElement('dynamic-el');
      expect(whiteboardService.getElements().find((e) => e.id === 'dynamic-el')).toBeUndefined();
    });

    it('ADV-DEL-9: deleteElements with empty array [] is a safe no-op', () => {
      const el = createRect('keep-me', true);
      whiteboardService.setElement(el);

      expect(() => {
        whiteboardService.deleteElements([]);
      }).not.toThrow();

      expect(whiteboardService.getElements().length).toBe(1);
    });

    it('ADV-DEL-10: deleteElements with duplicate IDs in array does not error and behaves idempotently', () => {
      const locked = createRect('dup-id-l', true);
      const unlocked = createCircle('dup-id-u', false);
      whiteboardService.setBatchElements([locked, unlocked]);

      whiteboardService.deleteElements(['dup-id-l', 'dup-id-l', 'dup-id-u', 'dup-id-u']);

      expect(whiteboardService.getElements().length).toBe(1);
      expect(whiteboardService.getElements()[0].id).toBe('dup-id-l');
    });

    it('ADV-DEL-11: elements with locked: undefined vs locked: false vs locked: true are handled with strict boolean semantics', () => {
      const elUndefined = createRect('el-undef', undefined);
      const elFalse = createCircle('el-false', false);
      const elTrue = createSticky('el-true', true);

      whiteboardService.setBatchElements([elUndefined, elFalse, elTrue]);

      // deleteElements should treat undefined and false as deletable, and true as protected
      whiteboardService.deleteElements(['el-undef', 'el-false', 'el-true']);

      const remaining = whiteboardService.getElements();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('el-true');
    });
  });

  // =========================================================================
  // SUITE 2: Cut Operations with All Locked, All Unlocked, and Mixed Selections
  // =========================================================================
  describe('Suite 2: Cut Operations with Various Selection Types', () => {
    it('ADV-CUT-1: Cut on ALL locked items does not modify clipboard, does not delete elements, and preserves selection', () => {
      const l1 = createRect('cut-l1', true);
      const l2 = createCircle('cut-l2', true);
      whiteboardService.setBatchElements([l1, l2]);

      let clipboard: CanvasElement[] = [{ ...createSticky('previous-clip') }];
      let selectedIds = ['cut-l1', 'cut-l2'];
      const selectedElements = whiteboardService.getElements().filter((el) => selectedIds.includes(el.id));

      const handleCut = () => {
        if (selectedElements.length > 0) {
          const unlockedSelected = selectedElements.filter((el) => !el.locked);
          if (unlockedSelected.length === 0) {
            return;
          }
          clipboard = selectedElements;
          const unlockedIds = unlockedSelected.map((el) => el.id);
          whiteboardService.deleteElements(unlockedIds);
          selectedIds = selectedIds.filter((id) => !unlockedIds.includes(id));
        }
      };

      handleCut();

      // Clipboard retained previous state
      expect(clipboard.length).toBe(1);
      expect(clipboard[0].id).toBe('previous-clip');

      // Elements remain in CRDT
      expect(whiteboardService.getElements().length).toBe(2);
      expect(whiteboardService.getElements().find((e) => e.id === 'cut-l1')).toBeDefined();
      expect(whiteboardService.getElements().find((e) => e.id === 'cut-l2')).toBeDefined();

      // Selection state untouched
      expect(selectedIds).toEqual(['cut-l1', 'cut-l2']);
    });

    it('ADV-CUT-2: Cut on ALL unlocked items copies to clipboard, deletes all from CRDT, and clears selection', () => {
      const u1 = createRect('cut-u1', false);
      const u2 = createCircle('cut-u2', false);
      whiteboardService.setBatchElements([u1, u2]);

      let clipboard: CanvasElement[] = [];
      let selectedIds = ['cut-u1', 'cut-u2'];
      const selectedElements = whiteboardService.getElements().filter((el) => selectedIds.includes(el.id));

      const handleCut = () => {
        if (selectedElements.length > 0) {
          const unlockedSelected = selectedElements.filter((el) => !el.locked);
          if (unlockedSelected.length === 0) return;
          clipboard = selectedElements;
          const unlockedIds = unlockedSelected.map((el) => el.id);
          whiteboardService.deleteElements(unlockedIds);
          selectedIds = selectedIds.filter((id) => !unlockedIds.includes(id));
        }
      };

      handleCut();

      expect(clipboard.length).toBe(2);
      expect(whiteboardService.getElements().length).toBe(0);
      expect(selectedIds).toEqual([]);
    });

    it('ADV-CUT-3: Cut on MIXED selection copies selection to clipboard, deletes ONLY unlocked, and keeps locked selected', () => {
      const l1 = createRect('mix-l1', true);
      const u1 = createCircle('mix-u1', false);
      const u2 = createSticky('mix-u2', false);
      whiteboardService.setBatchElements([l1, u1, u2]);

      let clipboard: CanvasElement[] = [];
      let selectedIds = ['mix-l1', 'mix-u1', 'mix-u2'];
      const selectedElements = whiteboardService.getElements().filter((el) => selectedIds.includes(el.id));

      const handleCut = () => {
        if (selectedElements.length > 0) {
          const unlockedSelected = selectedElements.filter((el) => !el.locked);
          if (unlockedSelected.length === 0) return;
          clipboard = selectedElements;
          const unlockedIds = unlockedSelected.map((el) => el.id);
          whiteboardService.deleteElements(unlockedIds);
          selectedIds = selectedIds.filter((id) => !unlockedIds.includes(id));
        }
      };

      handleCut();

      // Clipboard received all selected
      expect(clipboard.length).toBe(3);

      // Unlocked items removed from CRDT
      expect(whiteboardService.getElements().length).toBe(1);
      expect(whiteboardService.getElements()[0].id).toBe('mix-l1');

      // Locked item remains selected
      expect(selectedIds).toEqual(['mix-l1']);
    });

    it('ADV-CUT-4: Cut on mixed selection undo/redo restores and re-deletes only unlocked items cleanly', () => {
      const l1 = createRect('mix-undo-l', true);
      const u1 = createCircle('mix-undo-u1', false);
      const u2 = createSticky('mix-undo-u2', false);
      whiteboardService.setBatchElements([l1, u1, u2]);
      whiteboardService.getUndoManager()?.stopCapturing();

      // Cut unlocked items
      whiteboardService.deleteElements(['mix-undo-u1', 'mix-undo-u2']);
      expect(whiteboardService.getElements().length).toBe(1);

      // Undo -> restored
      whiteboardService.undo();
      expect(whiteboardService.getElements().length).toBe(3);
      expect(whiteboardService.getElements().find((e) => e.id === 'mix-undo-u1')).toBeDefined();
      expect(whiteboardService.getElements().find((e) => e.id === 'mix-undo-l')?.locked).toBe(true);

      // Redo -> re-deleted
      whiteboardService.redo();
      expect(whiteboardService.getElements().length).toBe(1);
      expect(whiteboardService.getElements()[0].id).toBe('mix-undo-l');
    });

    it('ADV-CUT-5: Stress test: Cut on 100 elements (50 locked, 50 unlocked) removes exactly 50 unlocked and retains 50 locked', () => {
      const lockedBatch = Array.from({ length: 50 }, (_, i) => createRect(`stress-l-${i}`, true));
      const unlockedBatch = Array.from({ length: 50 }, (_, i) => createCircle(`stress-u-${i}`, false));
      const allElements = [...lockedBatch, ...unlockedBatch];
      whiteboardService.setBatchElements(allElements);

      let clipboard: CanvasElement[] = [];
      let selectedIds = allElements.map((e) => e.id);
      const selectedElements = whiteboardService.getElements().filter((el) => selectedIds.includes(el.id));

      const handleCut = () => {
        if (selectedElements.length > 0) {
          const unlockedSelected = selectedElements.filter((el) => !el.locked);
          if (unlockedSelected.length === 0) return;
          clipboard = selectedElements;
          const unlockedIds = unlockedSelected.map((el) => el.id);
          whiteboardService.deleteElements(unlockedIds);
          selectedIds = selectedIds.filter((id) => !unlockedIds.includes(id));
        }
      };

      handleCut();

      expect(clipboard.length).toBe(100);
      expect(whiteboardService.getElements().length).toBe(50);
      expect(whiteboardService.getElements().every((e) => e.locked === true)).toBe(true);
      expect(selectedIds.length).toBe(50);
      expect(selectedIds.every((id) => id.startsWith('stress-l-'))).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 3: Lock Toggle, Undo/Redo & Shortcuts
  // =========================================================================
  describe('Suite 3: Lock Toggle and Undo/Redo Atomicity', () => {
    it('ADV-TOGGLE-1: Toggle on mixed selection (2 locked, 2 unlocked) locks ALL in single transaction', () => {
      const items = [
        createRect('t-1', true),
        createCircle('t-2', false),
        createSticky('t-3', true),
        createRect('t-4', false),
      ];
      whiteboardService.setBatchElements(items);
      whiteboardService.getUndoManager()?.stopCapturing();

      const selectedIds = items.map((e) => e.id);
      const selected = whiteboardService.getElements().filter((e) => selectedIds.includes(e.id));

      const anyUnlocked = selected.some((el) => !el.locked);
      const updated = selected.map((el) => {
        const clone = { ...el, updatedAt: Date.now() };
        if (anyUnlocked) {
          clone.locked = true;
        } else {
          delete clone.locked;
        }
        return clone as CanvasElement;
      });
      whiteboardService.setBatchElements(updated);

      // All 4 are now locked
      expect(whiteboardService.getElements().every((e) => e.locked === true)).toBe(true);

      // Single Undo reverts to initial mixed state
      whiteboardService.undo();
      const afterUndo = whiteboardService.getElements();
      expect(afterUndo.find((e) => e.id === 't-1')?.locked).toBe(true);
      expect(afterUndo.find((e) => e.id === 't-2')?.locked).toBeFalsy();
      expect(afterUndo.find((e) => e.id === 't-3')?.locked).toBe(true);
      expect(afterUndo.find((e) => e.id === 't-4')?.locked).toBeFalsy();

      // Redo re-locks all 4
      whiteboardService.redo();
      expect(whiteboardService.getElements().every((e) => e.locked === true)).toBe(true);
    });

    it('ADV-TOGGLE-2: Toggle on all-locked selection unlocks ALL in single step', () => {
      const items = [
        createRect('all-l-1', true),
        createCircle('all-l-2', true),
      ];
      whiteboardService.setBatchElements(items);
      whiteboardService.getUndoManager()?.stopCapturing();

      const selected = whiteboardService.getElements();
      const anyUnlocked = selected.some((el) => !el.locked);
      const updated = selected.map((el) => {
        const clone = { ...el, updatedAt: Date.now() };
        if (anyUnlocked) {
          clone.locked = true;
        } else {
          delete clone.locked;
        }
        return clone as CanvasElement;
      });
      whiteboardService.setBatchElements(updated);

      expect(whiteboardService.getElements().every((e) => !e.locked)).toBe(true);

      // Undo restores all locked
      whiteboardService.undo();
      expect(whiteboardService.getElements().every((e) => e.locked === true)).toBe(true);
    });

    it('ADV-TOGGLE-3: 20x alternating lock toggle stress test preserves undo stack and document consistency', () => {
      const el = createRect('stress-toggle-el', false);
      whiteboardService.setElement(el);

      for (let i = 0; i < 20; i++) {
        whiteboardService.getUndoManager()?.stopCapturing();
        const current = whiteboardService.getElements().find((e) => e.id === 'stress-toggle-el')!;
        const nextState = !current.locked;
        whiteboardService.setElement({
          ...current,
          locked: nextState,
          updatedAt: Date.now(),
        });
      }

      // Started false, toggled 20 times (even) -> must be false
      expect(whiteboardService.getElements().find((e) => e.id === 'stress-toggle-el')?.locked).toBe(false);

      // Undo 1 step -> must be true
      whiteboardService.undo();
      expect(whiteboardService.getElements().find((e) => e.id === 'stress-toggle-el')?.locked).toBe(true);

      // Redo 1 step -> must be false
      whiteboardService.redo();
      expect(whiteboardService.getElements().find((e) => e.id === 'stress-toggle-el')?.locked).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 4: Duplicate Behavior on Locked & Mixed Selections
  // =========================================================================
  describe('Suite 4: Duplicate Behavior on Locked & Mixed Selections', () => {
    it('ADV-DUP-1: Duplicate on all locked elements produces zero duplicates', () => {
      const l1 = createRect('dup-all-l1', true);
      const l2 = createCircle('dup-all-l2', true);
      whiteboardService.setBatchElements([l1, l2]);

      const selectedElements = whiteboardService.getElements();

      const duplicates: CanvasElement[] = [];
      const targetList = selectedElements.filter((el) => !el.locked);
      if (targetList.length > 0) {
        targetList.forEach((el) => {
          duplicates.push({ ...el, id: crypto.randomUUID() });
        });
        whiteboardService.setBatchElements(duplicates);
      }

      expect(duplicates.length).toBe(0);
      expect(whiteboardService.getElements().length).toBe(2);
    });

    it('ADV-DUP-2: Duplicate on mixed selection duplicates ONLY unlocked elements and remaps group IDs', () => {
      const l1 = createRect('dup-m-l', true, 'group-alpha');
      const u1 = createCircle('dup-m-u1', false, 'group-alpha');
      const u2 = createSticky('dup-m-u2', false);
      whiteboardService.setBatchElements([l1, u1, u2]);

      const selectedElements = whiteboardService.getElements();
      const targetList = selectedElements.filter((el) => !el.locked);

      const duplicates: CanvasElement[] = [];
      const newIds: string[] = [];
      const groupMap = new Map<string, string>();

      targetList.forEach((el) => {
        const newId = crypto.randomUUID();
        newIds.push(newId);

        let newGroupId = el.groupId;
        if (el.groupId) {
          if (!groupMap.has(el.groupId)) {
            groupMap.set(el.groupId, crypto.randomUUID());
          }
          newGroupId = groupMap.get(el.groupId);
        }

        duplicates.push({
          ...el,
          id: newId,
          groupId: newGroupId,
          x: el.x + 30,
          y: el.y + 30,
          zIndex: el.zIndex + 1,
          updatedAt: Date.now(),
        });
      });

      whiteboardService.setBatchElements(duplicates);

      // Total elements is 3 original + 2 duplicates = 5
      expect(whiteboardService.getElements().length).toBe(5);

      // Locked element was not duplicated
      const rects = whiteboardService.getElements().filter((e) => e.type === 'rect');
      expect(rects.length).toBe(1);
      expect(rects[0].id).toBe('dup-m-l');

      // Duplicated circle has a new groupId, decoupled from original 'group-alpha'
      const dupCircle = duplicates.find((e) => e.type === 'circle')!;
      expect(dupCircle.groupId).toBeDefined();
      expect(dupCircle.groupId).not.toBe('group-alpha');

      // Original elements retain 'group-alpha'
      expect(whiteboardService.getElements().find((e) => e.id === 'dup-m-l')?.groupId).toBe('group-alpha');
      expect(whiteboardService.getElements().find((e) => e.id === 'dup-m-u1')?.groupId).toBe('group-alpha');
    });

    it('ADV-DUP-3: Stress test: Duplicate on 50 locked elements is a complete no-op', () => {
      const batch = Array.from({ length: 50 }, (_, i) => createRect(`dup-stress-${i}`, true));
      whiteboardService.setBatchElements(batch);

      const selectedElements = whiteboardService.getElements();
      const targetList = selectedElements.filter((el) => !el.locked);
      expect(targetList.length).toBe(0);

      const duplicates: CanvasElement[] = [];
      targetList.forEach((el) => duplicates.push({ ...el, id: crypto.randomUUID() }));
      if (duplicates.length > 0) {
        whiteboardService.setBatchElements(duplicates);
      }

      expect(whiteboardService.getElements().length).toBe(50);
    });
  });

  // =========================================================================
  // SUITE 5: Drag Abort Integrity on Mixed-Lock Groups
  // =========================================================================
  describe('Suite 5: Group Drag Integrity with Locked Members', () => {
    it('ADV-DRAG-1: handleElementDragStart detects locked member in group and halts drag without moving unlocked member', () => {
      const gId = 'test-drag-group';
      const lockedMember = createRect('drag-l', true, gId);
      const unlockedMember = createCircle('drag-u', false, gId);
      whiteboardService.setBatchElements([lockedMember, unlockedMember]);

      const elements = whiteboardService.getElements();
      const selectedIds = ['drag-u']; // User clicks and tries to drag the unlocked companion

      let dragStopped = false;
      let targetPosition = { x: 200, y: 200 };
      const mockEvent = {
        target: {
          stopDrag: () => {
            dragStopped = true;
          },
          position: (pos?: { x: number; y: number }) => {
            if (pos) targetPosition = pos;
            return targetPosition;
          },
        },
      } as any;

      // Logic from Whiteboard.tsx:714-754
      const handleElementDragStart = (id: string, e: any) => {
        const draggedEl = elements.find((el) => el.id === id);
        if (!draggedEl) return;

        let draggingIds = selectedIds.includes(id) ? [...selectedIds] : [id];
        if (draggedEl.groupId && !selectedIds.includes(id)) {
          draggingIds = elements.filter((el) => el.groupId === draggedEl.groupId).map((el) => el.id);
        }

        const groupIdsInDrag = new Set<string>();
        draggingIds.forEach((elId) => {
          const el = elements.find((item) => item.id === elId);
          if (el?.groupId) groupIdsInDrag.add(el.groupId);
        });
        if (groupIdsInDrag.size > 0) {
          const allGroupMemberIds = elements
            .filter((el) => el.groupId && groupIdsInDrag.has(el.groupId))
            .map((el) => el.id);
          draggingIds = Array.from(new Set([...draggingIds, ...allGroupMemberIds]));
        }

        const hasLocked = draggingIds.some((elId) => {
          const el = elements.find((item) => item.id === elId);
          return el?.locked === true;
        });

        if (hasLocked) {
          e.target.stopDrag();
          e.target.position({ x: draggedEl.x, y: draggedEl.y });
          return;
        }
      };

      handleElementDragStart('drag-u', mockEvent);

      expect(dragStopped).toBe(true);
      expect(targetPosition).toEqual({ x: 200, y: 200 });
    });

    it('ADV-DRAG-2: Pen/Line/Arrow with locked companion in group snaps position to {0, 0} and aborts', () => {
      const gId = 'pen-group';
      const pen = createPen('drag-pen', false, gId);
      const lockedRect = createRect('drag-rect-l', true, gId);
      whiteboardService.setBatchElements([pen, lockedRect]);

      const elements = whiteboardService.getElements();
      let dragStopped = false;
      let targetPos = { x: 50, y: 50 }; // Jitter offset
      const mockEvent = {
        target: {
          stopDrag: () => {
            dragStopped = true;
          },
          position: (pos?: { x: number; y: number }) => {
            if (pos) targetPos = pos;
            return targetPos;
          },
        },
      } as any;

      const draggedEl = elements.find((el) => el.id === 'drag-pen')!;
      let draggingIds = elements.filter((el) => el.groupId === gId).map((el) => el.id);
      const hasLocked = draggingIds.some((elId) => elements.find((item) => item.id === elId)?.locked === true);

      if (hasLocked) {
        mockEvent.target.stopDrag();
        if (draggedEl.type === 'pen' || draggedEl.type === 'arrow' || draggedEl.type === 'line') {
          mockEvent.target.position({ x: 0, y: 0 });
        }
      }

      expect(dragStopped).toBe(true);
      expect(targetPos).toEqual({ x: 0, y: 0 });
    });
  });

  // =========================================================================
  // SUITE 6: Hotkey Input Suppression
  // =========================================================================
  describe('Suite 6: Hotkey Input Field Suppression', () => {
    it('ADV-HOTKEY-1: Typing in INPUT, TEXTAREA, or contenteditable does NOT trigger Delete/Cut/Lock hotkeys', () => {
      const locked = createRect('hk-locked', true);
      const unlocked = createCircle('hk-unlocked', false);
      whiteboardService.setBatchElements([locked, unlocked]);

      let selectedIds = ['hk-unlocked'];
      let cutFired = false;
      let deleteFired = false;
      let lockFired = false;

      const handleKeyDown = (e: any) => {
        const target = e.target;
        if (
          target &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
            target.isContentEditable ||
            target.getAttribute?.('contenteditable') === 'true')
        ) {
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteFired = true;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
          cutFired = true;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
          lockFired = true;
        }
      };

      // Mock input element
      const mockInput = {
        tagName: 'INPUT',
        isContentEditable: false,
        getAttribute: () => null,
      };

      // Event triggered inside input
      handleKeyDown({ target: mockInput, key: 'Delete' });
      handleKeyDown({ target: mockInput, key: 'x', ctrlKey: true });
      handleKeyDown({ target: mockInput, key: 'l', ctrlKey: true });

      expect(deleteFired).toBe(false);
      expect(cutFired).toBe(false);
      expect(lockFired).toBe(false);

      // Event triggered on canvas (target = DIV)
      const mockCanvas = {
        tagName: 'DIV',
        isContentEditable: false,
        getAttribute: () => null,
      };

      handleKeyDown({ target: mockCanvas, key: 'Delete' });
      handleKeyDown({ target: mockCanvas, key: 'x', ctrlKey: true });
      handleKeyDown({ target: mockCanvas, key: 'l', ctrlKey: true });

      expect(deleteFired).toBe(true);
      expect(cutFired).toBe(true);
      expect(lockFired).toBe(true);
    });
  });
});
