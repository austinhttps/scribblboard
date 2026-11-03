import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Track rendered Konva nodes and layer mock
const renderedNodesById = new Map<string, any>();
const konvaNodesMap = new Map<string, any>();

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

vi.mock('konva', () => {
  return {
    default: {
      Stage: () => null,
      Layer: () => null,
      Rect: () => null,
      Circle: () => null,
      Line: () => null,
      Arrow: () => null,
      Text: () => null,
      Group: () => null,
      Transformer: () => null,
    },
  };
});

vi.mock('react-konva', () => {
  const recordProps = (type: string, props: any, ref?: any) => {
    if (props && props.id) {
      renderedNodesById.set(props.id, { type, ...props });
    }
    return React.createElement('div', { 'data-konva-type': type, ...props, ref }, props?.children);
  };

  return {
    Stage: React.forwardRef((props: any, ref: any) => recordProps('Stage', props, ref)),
    Layer: React.forwardRef((props: any, ref: any) => {
      // Mock Layer methods needed by Whiteboard.tsx
      React.useImperativeHandle(ref, () => ({
        findOne: (selector: string) => {
          const id = selector.replace('#', '');
          return konvaNodesMap.get(id);
        },
        batchDraw: vi.fn(),
      }));
      return React.createElement('div', { 'data-konva-type': 'Layer', ...props }, props?.children);
    }),
    Rect: React.forwardRef((props: any, ref: any) => recordProps('Rect', props, ref)),
    Circle: React.forwardRef((props: any, ref: any) => recordProps('Circle', props, ref)),
    Line: React.forwardRef((props: any, ref: any) => recordProps('Line', props, ref)),
    Arrow: React.forwardRef((props: any, ref: any) => recordProps('Arrow', props, ref)),
    Text: React.forwardRef((props: any, ref: any) => recordProps('Text', props, ref)),
    Group: React.forwardRef((props: any, ref: any) => recordProps('Group', props, ref)),
    Image: React.forwardRef((props: any, ref: any) => recordProps('Image', props, ref)),
    Transformer: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        nodes: vi.fn(),
        getLayer: () => ({ batchDraw: vi.fn() }),
      }));
      return recordProps('Transformer', props, ref);
    }),
  };
});

import { whiteboardService } from '../../src/services/yjsDoc';
import { Whiteboard } from '../../src/components/Canvas/Whiteboard';
import {
  CanvasElement,
  RectElement,
  CircleElement,
  PenElement,
  StickyElement,
  TextElement,
} from '../../src/types/whiteboard';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Empirical Challenger M1-It2: Mixed-Lock Drag, GroupId Remapping & Atomic Undo/Redo', () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
    renderedNodesById.clear();
    konvaNodesMap.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    whiteboardService.initBoard(`test-m1-it2-${Date.now()}-${Math.random()}`);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    whiteboardService.cleanup();
    vi.restoreAllMocks();
  });

  // Helper to mount Whiteboard with given elements
  const mountWhiteboard = async (
    elements: CanvasElement[],
    selectedIds: string[] = [],
    callbacks: Partial<React.ComponentProps<typeof Whiteboard>> = {}
  ) => {
    // Populate mock Konva nodes map for Layer.findOne
    elements.forEach((el) => {
      konvaNodesMap.set(el.id, {
        id: () => el.id,
        x: () => el.x,
        y: () => el.y,
        position: vi.fn(),
      });
    });

    const defaultProps: React.ComponentProps<typeof Whiteboard> = {
      elements,
      comments: [],
      localUser: { clientId: 1, name: 'Tester', color: '#ff0000' },
      currentTool: 'select',
      toolProperties: {
        color: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2,
        fontSize: 16,
        fontFamily: 'sans-serif',
      },
      gridType: 'dots',
      theme: 'light',
      onSetTool: vi.fn(),
      onSetElement: vi.fn(),
      onSetBatchElements: vi.fn(),
      onDeleteElement: vi.fn(),
      onDeleteElements: vi.fn(),
      getNextZIndex: () => elements.length + 1,
      stageRef: { current: null },
      selectedIds,
      setSelectedIds: vi.fn(),
      onUploadImagePrompt: vi.fn(),
      clipboard: [],
      onCopyElements: vi.fn(),
      onCutElements: vi.fn(),
      onPasteElements: vi.fn(),
      collaborators: [],
      onUpdateCursor: vi.fn(),
      onToggleReaction: vi.fn(),
      onOpenEmojiPicker: vi.fn(),
      onOpenComments: vi.fn(),
      ...callbacks,
    };

    await act(async () => {
      root.render(<Whiteboard {...defaultProps} />);
    });

    return defaultProps;
  };

  // =========================================================================
  // 1. MIXED-LOCK GROUP DRAG BEHAVIOR
  // =========================================================================
  describe('1. Mixed-Lock Group Drag Behavior', () => {
    it('CHALLENGE-DRAG-1.1: dragging unlocked rect in group with locked member calls stopDrag(), snaps node back, and commits zero coordinate changes', async () => {
      const gId = 'mixed-group-1';
      const unlockedRect: RectElement = {
        id: 'unlocked-rect',
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
        locked: false,
      };

      const lockedRect: RectElement = {
        id: 'locked-rect',
        type: 'rect',
        x: 300,
        y: 100,
        width: 80,
        height: 60,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        zIndex: 2,
        updatedAt: 1000,
        groupId: gId,
        locked: true,
      };

      const onSetBatchElements = vi.fn();
      const onSetElement = vi.fn();

      await mountWhiteboard([unlockedRect, lockedRect], ['unlocked-rect', 'locked-rect'], {
        onSetBatchElements,
        onSetElement,
      });

      const unlockedProps = renderedNodesById.get('unlocked-rect');
      expect(unlockedProps).toBeDefined();
      expect(unlockedProps.draggable).toBe(true);

      const lockedProps = renderedNodesById.get('locked-rect');
      expect(lockedProps).toBeDefined();
      expect(lockedProps.draggable).toBe(false);

      // Create mock Konva event for dragging the unlocked rect
      const mockStopDrag = vi.fn();
      const mockPosition = vi.fn();
      const mockEvent = {
        target: {
          x: () => 150,
          y: () => 150,
          stopDrag: mockStopDrag,
          position: mockPosition,
        },
      } as any;

      // 1. Trigger dragStart on unlocked companion
      act(() => {
        unlockedProps.onDragStart(mockEvent);
      });

      // Verify stopDrag was called immediately!
      expect(mockStopDrag).toHaveBeenCalledTimes(1);

      // Verify position was snapped back to initial coordinates (100, 100)
      expect(mockPosition).toHaveBeenCalledWith({ x: 100, y: 100 });

      // 2. Trigger dragMove (should be a no-op because drag was aborted)
      act(() => {
        unlockedProps.onDragMove(mockEvent);
      });

      // 3. Trigger dragEnd
      act(() => {
        unlockedProps.onDragEnd(mockEvent);
      });

      // Crucial assertion: onSetBatchElements and onSetElement were NEVER called!
      expect(onSetBatchElements).not.toHaveBeenCalled();
      expect(onSetElement).not.toHaveBeenCalled();
    });

    it('CHALLENGE-DRAG-1.2: dragging unlocked pen in group with locked member snaps pen node back to (0,0) and does not fracture group', async () => {
      const gId = 'mixed-pen-group';
      const unlockedPen: PenElement = {
        id: 'unlocked-pen',
        type: 'pen',
        x: 0,
        y: 0,
        points: [50, 50, 80, 80],
        stroke: '#ff0000',
        strokeWidth: 3,
        zIndex: 1,
        updatedAt: 1000,
        groupId: gId,
        locked: false,
      };

      const lockedCircle: CircleElement = {
        id: 'locked-circle',
        type: 'circle',
        x: 200,
        y: 200,
        radiusX: 40,
        radiusY: 40,
        fill: '#00ff00',
        stroke: '#000000',
        strokeWidth: 1,
        zIndex: 2,
        updatedAt: 1000,
        groupId: gId,
        locked: true,
      };

      const onSetBatchElements = vi.fn();
      await mountWhiteboard([unlockedPen, lockedCircle], ['unlocked-pen'], {
        onSetBatchElements,
      });

      const penProps = renderedNodesById.get('unlocked-pen');
      expect(penProps.draggable).toBe(true);

      const mockStopDrag = vi.fn();
      const mockPosition = vi.fn();
      const mockEvent = {
        target: {
          x: () => 60,
          y: () => 60,
          stopDrag: mockStopDrag,
          position: mockPosition,
        },
      } as any;

      // Trigger dragStart on unlocked pen
      act(() => {
        penProps.onDragStart(mockEvent);
      });

      expect(mockStopDrag).toHaveBeenCalledTimes(1);
      // For pen, position resets to (0, 0)
      expect(mockPosition).toHaveBeenCalledWith({ x: 0, y: 0 });

      // Trigger dragEnd
      act(() => {
        penProps.onDragEnd(mockEvent);
      });

      expect(onSetBatchElements).not.toHaveBeenCalled();
    });

    it('CHALLENGE-DRAG-1.3: multi-group selection where Group A is unlocked and Group B has a locked member aborts drag on Group A', async () => {
      const gA = 'group-unlocked';
      const gB = 'group-partially-locked';

      const a1: RectElement = { id: 'a1', type: 'rect', x: 10, y: 10, width: 50, height: 50, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 1, updatedAt: 1, groupId: gA };
      const a2: RectElement = { id: 'a2', type: 'rect', x: 70, y: 10, width: 50, height: 50, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 2, updatedAt: 1, groupId: gA };
      const b1: RectElement = { id: 'b1', type: 'rect', x: 10, y: 100, width: 50, height: 50, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 3, updatedAt: 1, groupId: gB };
      const b2: RectElement = { id: 'b2', type: 'rect', x: 70, y: 100, width: 50, height: 50, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 4, updatedAt: 1, groupId: gB, locked: true };

      const onSetBatchElements = vi.fn();
      // Both groups selected
      await mountWhiteboard([a1, a2, b1, b2], ['a1', 'a2', 'b1', 'b2'], { onSetBatchElements });

      const a1Props = renderedNodesById.get('a1');
      const mockStopDrag = vi.fn();
      const mockPosition = vi.fn();
      const mockEvent = {
        target: {
          x: () => 40,
          y: () => 40,
          stopDrag: mockStopDrag,
          position: mockPosition,
        },
      } as any;

      // User tries dragging a1 (which is unlocked in Group A)
      act(() => {
        a1Props.onDragStart(mockEvent);
      });

      // Entire drag is halted because b2 in selection is locked
      expect(mockStopDrag).toHaveBeenCalledTimes(1);
      expect(mockPosition).toHaveBeenCalledWith({ x: 10, y: 10 });

      act(() => {
        a1Props.onDragEnd(mockEvent);
      });

      expect(onSetBatchElements).not.toHaveBeenCalled();
    });

    it('CHALLENGE-DRAG-1.4: fully unlocked group moves and commits all members atomically on dragEnd', async () => {
      const gClean = 'group-clean';
      const c1: RectElement = { id: 'c1', type: 'rect', x: 20, y: 30, width: 50, height: 50, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 1, updatedAt: 1, groupId: gClean };
      const c2: RectElement = { id: 'c2', type: 'rect', x: 100, y: 150, width: 50, height: 50, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 2, updatedAt: 1, groupId: gClean };

      const onSetBatchElements = vi.fn();
      await mountWhiteboard([c1, c2], ['c1', 'c2'], { onSetBatchElements });

      const c1Props = renderedNodesById.get('c1');
      const mockStopDrag = vi.fn();
      const mockPosition = vi.fn();
      const mockEvent = {
        target: {
          x: () => 50, // dx = +30
          y: () => 70, // dy = +40
          stopDrag: mockStopDrag,
          position: mockPosition,
        },
      } as any;

      act(() => {
        c1Props.onDragStart(mockEvent);
      });

      expect(mockStopDrag).not.toHaveBeenCalled();

      act(() => {
        c1Props.onDragEnd(mockEvent);
      });

      expect(onSetBatchElements).toHaveBeenCalledTimes(1);
      const committed = onSetBatchElements.mock.calls[0][0] as CanvasElement[];
      expect(committed).toHaveLength(2);

      const m1 = committed.find((e) => e.id === 'c1')!;
      const m2 = committed.find((e) => e.id === 'c2')!;
      expect(m1.x).toBe(50);
      expect(m1.y).toBe(70);
      expect(m2.x).toBe(130);
      expect(m2.y).toBe(190);
    });
  });

  // =========================================================================
  // 2. GROUPID REMAPPING ON DUPLICATION
  // =========================================================================
  describe('2. GroupId Remapping on Duplication', () => {
    // Exact logic from App.tsx handleDuplicateSelected
    const duplicateSelected = (
      elements: CanvasElement[],
      selectedIds: string[],
      getNextZIndex: () => number
    ): CanvasElement[] => {
      const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
      const targetList = selectedElements.filter((el) => !el.locked);
      if (targetList.length === 0) return [];

      const duplicates: CanvasElement[] = [];
      const groupMap = new Map<string, string>();

      targetList.forEach((el) => {
        const newId = crypto.randomUUID();

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
          zIndex: getNextZIndex(),
          updatedAt: Date.now(),
        });
      });

      return duplicates;
    };

    it('CHALLENGE-DUP-2.1: duplicating a group of 3 elements generates 3 duplicates with a fresh unique groupId', () => {
      const origGid = 'original-group-uuid-111';
      const el1: RectElement = { id: 'd-1', type: 'rect', x: 10, y: 10, width: 50, height: 50, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 1, updatedAt: 1, groupId: origGid };
      const el2: CircleElement = { id: 'd-2', type: 'circle', x: 80, y: 80, radiusX: 20, radiusY: 20, fill: '#fff', stroke: '#000', strokeWidth: 1, zIndex: 2, updatedAt: 1, groupId: origGid };
      const el3: StickyElement = { id: 'd-3', type: 'sticky', x: 150, y: 150, width: 100, height: 100, text: 'Note', color: 'yellow', fontSize: 14, zIndex: 3, updatedAt: 1, groupId: origGid };

      const all = [el1, el2, el3];
      const duplicates = duplicateSelected(all, ['d-1', 'd-2', 'd-3'], () => 10);

      expect(duplicates).toHaveLength(3);

      const [dup1, dup2, dup3] = duplicates;

      // Unique element IDs
      expect(dup1.id).not.toBe('d-1');
      expect(dup2.id).not.toBe('d-2');
      expect(dup3.id).not.toBe('d-3');

      // All 3 duplicates share the exact same new groupId
      expect(dup1.groupId).toBeDefined();
      expect(dup1.groupId).toBe(dup2.groupId);
      expect(dup2.groupId).toBe(dup3.groupId);

      // New groupId is valid UUID and distinct from original
      expect(dup1.groupId).toMatch(UUID_REGEX);
      expect(dup1.groupId).not.toBe(origGid);

      // Offset by (+30, +30)
      expect(dup1.x).toBe(40);
      expect(dup1.y).toBe(40);
      expect(dup2.x).toBe(110);
      expect(dup2.y).toBe(110);
      expect(dup3.x).toBe(180);
      expect(dup3.y).toBe(180);

      // Originals in store unchanged
      expect(el1.groupId).toBe(origGid);
      expect(el2.groupId).toBe(origGid);
      expect(el3.groupId).toBe(origGid);
    });

    it('CHALLENGE-DUP-2.2: duplicating multiple groups at once preserves separation with distinct new groupIds', () => {
      const gA = 'group-A-orig';
      const gB = 'group-B-orig';

      const a1 = { id: 'a1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: gA } as CanvasElement;
      const a2 = { id: 'a2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: gA } as CanvasElement;
      const b1 = { id: 'b1', type: 'rect', x: 100, y: 100, zIndex: 3, updatedAt: 1, groupId: gB } as CanvasElement;
      const b2 = { id: 'b2', type: 'rect', x: 120, y: 120, zIndex: 4, updatedAt: 1, groupId: gB } as CanvasElement;
      const b3 = { id: 'b3', type: 'rect', x: 140, y: 140, zIndex: 5, updatedAt: 1, groupId: gB } as CanvasElement;

      const duplicates = duplicateSelected([a1, a2, b1, b2, b3], ['a1', 'a2', 'b1', 'b2', 'b3'], () => 10);
      expect(duplicates).toHaveLength(5);

      const dupA = duplicates.slice(0, 2);
      const dupB = duplicates.slice(2, 5);

      // Cloned Group A members share newGroupIdA
      expect(dupA[0].groupId).toBe(dupA[1].groupId);
      // Cloned Group B members share newGroupIdB
      expect(dupB[0].groupId).toBe(dupB[1].groupId);
      expect(dupB[1].groupId).toBe(dupB[2].groupId);

      // Groups A and B do NOT share groupId
      expect(dupA[0].groupId).not.toBe(dupB[0].groupId);
      expect(dupA[0].groupId).not.toBe(gA);
      expect(dupB[0].groupId).not.toBe(gB);
    });

    it('CHALLENGE-DUP-2.3: duplicating mixed selection of grouped and ungrouped items keeps ungrouped items with groupId: undefined', () => {
      const gId = 'group-mixed-dup';
      const grouped1 = { id: 'gm-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: gId } as CanvasElement;
      const grouped2 = { id: 'gm-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: gId } as CanvasElement;
      const solo = { id: 'solo-item', type: 'rect', x: 50, y: 50, zIndex: 3, updatedAt: 1 } as CanvasElement;

      const duplicates = duplicateSelected([grouped1, grouped2, solo], ['gm-1', 'gm-2', 'solo-item'], () => 10);
      expect(duplicates).toHaveLength(3);

      const dupGrouped = duplicates.filter((d) => d.id !== 'solo-item' && d.groupId !== undefined);
      const dupSolo = duplicates.find((d) => d.groupId === undefined);

      expect(dupGrouped).toHaveLength(2);
      expect(dupGrouped[0].groupId).toBe(dupGrouped[1].groupId);
      expect(dupGrouped[0].groupId).not.toBe(gId);

      expect(dupSolo).toBeDefined();
      expect(dupSolo!.groupId).toBeUndefined();
    });

    it('CHALLENGE-DUP-2.4: locked elements in group are shielded from duplication', () => {
      const gId = 'locked-dup-group';
      const unlockedEl = { id: 'ld-unlocked', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: gId, locked: false } as CanvasElement;
      const lockedEl = { id: 'ld-locked', type: 'rect', x: 50, y: 50, zIndex: 2, updatedAt: 1, groupId: gId, locked: true } as CanvasElement;

      const duplicates = duplicateSelected([unlockedEl, lockedEl], ['ld-unlocked', 'ld-locked'], () => 10);
      // Only the unlocked element is duplicated!
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].x).toBe(40);
      expect(duplicates[0].y).toBe(40);
      expect(duplicates[0].groupId).toMatch(UUID_REGEX);
      expect(duplicates[0].groupId).not.toBe(gId);

      // If ALL elements are locked, returns empty array (safe no-op)
      const allLocked = duplicateSelected([lockedEl], ['ld-locked'], () => 10);
      expect(allLocked).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. GROUPID REMAPPING ON PASTE
  // =========================================================================
  describe('3. GroupId Remapping on Paste', () => {
    // Exact logic from App.tsx handlePaste
    const pasteElements = (
      clipboard: CanvasElement[],
      getNextZIndex: () => number,
      point?: { x: number; y: number }
    ): CanvasElement[] => {
      if (clipboard.length === 0) return [];

      const newElements: CanvasElement[] = [];
      const groupMap = new Map<string, string>();
      clipboard.forEach((el) => {
        if (el.groupId && !groupMap.has(el.groupId)) {
          groupMap.set(el.groupId, crypto.randomUUID());
        }
      });

      let minX = Infinity, minY = Infinity;
      clipboard.forEach((el) => {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
      });

      clipboard.forEach((el) => {
        const newId = crypto.randomUUID();
        let targetX = el.x + 25;
        let targetY = el.y + 25;

        if (point) {
          const offsetX = el.x - minX;
          const offsetY = el.y - minY;
          targetX = point.x + offsetX;
          targetY = point.y + offsetY;
        }

        const newGroupId = el.groupId ? groupMap.get(el.groupId) : undefined;
        newElements.push({
          ...el,
          id: newId,
          groupId: newGroupId,
          x: targetX,
          y: targetY,
          zIndex: getNextZIndex(),
          updatedAt: Date.now(),
        });
      });

      return newElements;
    };

    it('CHALLENGE-PASTE-3.1: pasting grouped elements generates a fresh unique groupId shared by pasted members', () => {
      const gOrig = 'clip-group-1';
      const clipEl1 = { id: 'c1', type: 'rect', x: 100, y: 100, zIndex: 1, updatedAt: 1, groupId: gOrig } as CanvasElement;
      const clipEl2 = { id: 'c2', type: 'rect', x: 200, y: 200, zIndex: 2, updatedAt: 1, groupId: gOrig } as CanvasElement;

      const pasted = pasteElements([clipEl1, clipEl2], () => 1);
      expect(pasted).toHaveLength(2);

      const [p1, p2] = pasted;
      expect(p1.id).not.toBe('c1');
      expect(p2.id).not.toBe('c2');

      expect(p1.groupId).toBe(p2.groupId);
      expect(p1.groupId).toMatch(UUID_REGEX);
      expect(p1.groupId).not.toBe(gOrig);
    });

    it('CHALLENGE-PASTE-3.2: pasting twice in succession creates two independent groups with distinct unique groupIds', () => {
      const gOrig = 'clipboard-src-group';
      const clip1 = { id: 's1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: gOrig } as CanvasElement;
      const clip2 = { id: 's2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: gOrig } as CanvasElement;

      // 1st Paste
      const paste1 = pasteElements([clip1, clip2], () => 1);
      // 2nd Paste
      const paste2 = pasteElements([clip1, clip2], () => 2);

      const gidPaste1 = paste1[0].groupId;
      const gidPaste2 = paste2[0].groupId;

      expect(gidPaste1).toMatch(UUID_REGEX);
      expect(gidPaste2).toMatch(UUID_REGEX);

      // Must be completely distinct!
      expect(gidPaste1).not.toBe(gidPaste2);
      expect(gidPaste1).not.toBe(gOrig);
      expect(gidPaste2).not.toBe(gOrig);
    });

    it('CHALLENGE-PASTE-3.3: pasting multiple groups preserves group boundaries with distinct fresh groupIds', () => {
      const gA = 'clip-gA';
      const gB = 'clip-gB';

      const clipItems = [
        { id: 'a1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: gA } as CanvasElement,
        { id: 'a2', type: 'rect', x: 10, y: 10, zIndex: 2, updatedAt: 1, groupId: gA } as CanvasElement,
        { id: 'b1', type: 'rect', x: 50, y: 50, zIndex: 3, updatedAt: 1, groupId: gB } as CanvasElement,
        { id: 'b2', type: 'rect', x: 60, y: 60, zIndex: 4, updatedAt: 1, groupId: gB } as CanvasElement,
      ];

      const pasted = pasteElements(clipItems, () => 1);
      expect(pasted).toHaveLength(4);

      const newGA = pasted[0].groupId;
      const newGB = pasted[2].groupId;

      expect(pasted[0].groupId).toBe(newGA);
      expect(pasted[1].groupId).toBe(newGA);
      expect(pasted[2].groupId).toBe(newGB);
      expect(pasted[3].groupId).toBe(newGB);

      expect(newGA).not.toBe(newGB);
      expect(newGA).not.toBe(gA);
      expect(newGB).not.toBe(gB);
    });

    it('CHALLENGE-PASTE-3.4: pasting mixed clipboard leaves ungrouped items with groupId: undefined', () => {
      const clipItems = [
        { id: 'grp-item', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: 'orig-grp' } as CanvasElement,
        { id: 'solo-item', type: 'rect', x: 50, y: 50, zIndex: 2, updatedAt: 1 } as CanvasElement,
      ];

      const pasted = pasteElements(clipItems, () => 1);
      expect(pasted).toHaveLength(2);

      expect(pasted[0].groupId).toMatch(UUID_REGEX);
      expect(pasted[0].groupId).not.toBe('orig-grp');

      expect(pasted[1].groupId).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. UNGROUPING AND MULTI-GROUP ATOMIC UNDO/REDO
  // =========================================================================
  describe('4. Ungrouping and Multi-Group Atomic Undo/Redo', () => {
    it('CHALLENGE-UNDO-4.1: grouping 3 elements creates 1 atomic transaction; single undo() clears all groupIds; single redo() restores them', () => {
      const e1 = { id: 'u1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1 } as CanvasElement;
      const e2 = { id: 'u2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1 } as CanvasElement;
      const e3 = { id: 'u3', type: 'rect', x: 30, y: 30, zIndex: 3, updatedAt: 1 } as CanvasElement;

      // Seed initial elements outside undo tracking
      whiteboardService.setElements([e1, e2, e3], 'remote');
      whiteboardService.getUndoManager()?.stopCapturing();

      // Perform grouping in 1 atomic transaction
      const newGid = crypto.randomUUID();
      const grouped = [
        { ...e1, groupId: newGid },
        { ...e2, groupId: newGid },
        { ...e3, groupId: newGid },
      ];
      whiteboardService.setBatchElements(grouped, 'local');

      expect(whiteboardService.getElements().find((e) => e.id === 'u1')?.groupId).toBe(newGid);
      expect(whiteboardService.getElements().find((e) => e.id === 'u2')?.groupId).toBe(newGid);
      expect(whiteboardService.getElements().find((e) => e.id === 'u3')?.groupId).toBe(newGid);

      // Single undo reverts all 3 elements simultaneously
      expect(whiteboardService.canUndo()).toBe(true);
      whiteboardService.undo();

      expect(whiteboardService.getElements().find((e) => e.id === 'u1')?.groupId).toBeUndefined();
      expect(whiteboardService.getElements().find((e) => e.id === 'u2')?.groupId).toBeUndefined();
      expect(whiteboardService.getElements().find((e) => e.id === 'u3')?.groupId).toBeUndefined();

      // Single redo restores all 3 elements to the group simultaneously
      expect(whiteboardService.canRedo()).toBe(true);
      whiteboardService.redo();

      expect(whiteboardService.getElements().find((e) => e.id === 'u1')?.groupId).toBe(newGid);
      expect(whiteboardService.getElements().find((e) => e.id === 'u2')?.groupId).toBe(newGid);
      expect(whiteboardService.getElements().find((e) => e.id === 'u3')?.groupId).toBe(newGid);
    });

    it('CHALLENGE-UNDO-4.2: ungrouping a group clears groupId in 1 atomic transaction; single undo() restores group cohesion', () => {
      const gId = 'ungroup-atomic-id';
      const e1 = { id: 'ug1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: gId } as CanvasElement;
      const e2 = { id: 'ug2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: gId } as CanvasElement;

      whiteboardService.setElements([e1, e2], 'remote');
      whiteboardService.getUndoManager()?.stopCapturing();

      // Ungrouping
      const ungrouped = [e1, e2].map((el) => {
        const clone = { ...el, updatedAt: Date.now() };
        delete clone.groupId;
        return clone;
      });
      whiteboardService.setBatchElements(ungrouped, 'local');

      expect(whiteboardService.getElements().find((e) => e.id === 'ug1')?.groupId).toBeUndefined();
      expect(whiteboardService.getElements().find((e) => e.id === 'ug2')?.groupId).toBeUndefined();

      // Undo restores original groupId to both
      whiteboardService.undo();
      expect(whiteboardService.getElements().find((e) => e.id === 'ug1')?.groupId).toBe(gId);
      expect(whiteboardService.getElements().find((e) => e.id === 'ug2')?.groupId).toBe(gId);

      // Redo clears groupId again
      whiteboardService.redo();
      expect(whiteboardService.getElements().find((e) => e.id === 'ug1')?.groupId).toBeUndefined();
      expect(whiteboardService.getElements().find((e) => e.id === 'ug2')?.groupId).toBeUndefined();
    });

    it('CHALLENGE-UNDO-4.3: multi-group simultaneous ungrouping clears all groups in 1 transaction and undo restores all original distinct groupIds', () => {
      const g1 = 'group-1-distinct';
      const g2 = 'group-2-distinct';
      const g3 = 'group-3-distinct';

      const items: CanvasElement[] = [
        { id: 'm1-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: g1 },
        { id: 'm1-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: g1 },
        { id: 'm2-1', type: 'rect', x: 30, y: 30, zIndex: 3, updatedAt: 1, groupId: g2 },
        { id: 'm2-2', type: 'rect', x: 40, y: 40, zIndex: 4, updatedAt: 1, groupId: g2 },
        { id: 'm3-1', type: 'rect', x: 50, y: 50, zIndex: 5, updatedAt: 1, groupId: g3 },
        { id: 'm3-2', type: 'rect', x: 60, y: 60, zIndex: 6, updatedAt: 1, groupId: g3 },
      ];

      whiteboardService.setElements(items, 'remote');
      whiteboardService.getUndoManager()?.stopCapturing();

      // App.tsx handleUngroupSelected logic: user selects one member from each group
      const selected = [items[0], items[2], items[4]];
      const groupIdsToClear = new Set(selected.map((el) => el.groupId).filter(Boolean));

      const elementsToUpdate = whiteboardService.getElements()
        .filter((el) => el.groupId && groupIdsToClear.has(el.groupId))
        .map((el) => {
          const clone = { ...el, updatedAt: Date.now() };
          delete clone.groupId;
          return clone;
        });

      whiteboardService.setBatchElements(elementsToUpdate, 'local');

      // All 6 elements have groupId cleared
      for (const item of items) {
        expect(whiteboardService.getElements().find((e) => e.id === item.id)?.groupId).toBeUndefined();
      }

      // In ONE undo step, all 6 elements are restored to their original separate groupIds
      expect(whiteboardService.canUndo()).toBe(true);
      whiteboardService.undo();

      expect(whiteboardService.getElements().find((e) => e.id === 'm1-1')?.groupId).toBe(g1);
      expect(whiteboardService.getElements().find((e) => e.id === 'm1-2')?.groupId).toBe(g1);
      expect(whiteboardService.getElements().find((e) => e.id === 'm2-1')?.groupId).toBe(g2);
      expect(whiteboardService.getElements().find((e) => e.id === 'm2-2')?.groupId).toBe(g2);
      expect(whiteboardService.getElements().find((e) => e.id === 'm3-1')?.groupId).toBe(g3);
      expect(whiteboardService.getElements().find((e) => e.id === 'm3-2')?.groupId).toBe(g3);
    });

    it('CHALLENGE-UNDO-4.4: deleting elements protects locked elements even when grouped', () => {
      const gId = 'locked-del-group';
      const unlocked = { id: 'del-unlocked', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: gId, locked: false } as CanvasElement;
      const locked = { id: 'del-locked', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: gId, locked: true } as CanvasElement;

      whiteboardService.setBatchElements([unlocked, locked], 'remote');

      // Attempt to delete both via service
      whiteboardService.deleteElements(['del-unlocked', 'del-locked']);

      // Unlocked element is removed, locked element remains!
      expect(whiteboardService.getElements().find((e) => e.id === 'del-unlocked')).toBeUndefined();
      expect(whiteboardService.getElements().find((e) => e.id === 'del-locked')).toBeDefined();
    });
  });

  // =========================================================================
  // 5. ADVERSARIAL STRESS TEST: 50 ELEMENTS ACROSS 10 GROUPS
  // =========================================================================
  describe('5. Adversarial Stress Test: 50 Elements Across 10 Groups', () => {
    it('CHALLENGE-STRESS-5.1: 50 elements across 10 groups under rapid drag, duplicate, paste, undo/redo', () => {
      const allElements: CanvasElement[] = [];

      for (let g = 0; g < 10; g++) {
        const gId = `stress-group-${g}`;
        for (let i = 0; i < 5; i++) {
          allElements.push({
            id: `sg-${g}-${i}`,
            type: 'rect',
            x: g * 100 + i * 15,
            y: g * 50 + i * 10,
            width: 40,
            height: 30,
            fill: '#6366f1',
            stroke: '#4338ca',
            strokeWidth: 1,
            zIndex: g * 5 + i,
            updatedAt: 1000,
            groupId: gId,
            locked: g === 9 && i === 4, // 1 element in group 9 is locked
          } as CanvasElement);
        }
      }

      whiteboardService.setBatchElements(allElements, 'remote');
      whiteboardService.getUndoManager()?.stopCapturing();

      expect(whiteboardService.getElements()).toHaveLength(50);

      // 1. Move group 0 (all 5 members)
      const g0Members = whiteboardService.getElements().filter((e) => e.groupId === 'stress-group-0');
      const movedG0 = g0Members.map((m) => ({ ...m, x: m.x + 200, y: m.y + 100 }));
      whiteboardService.setBatchElements(movedG0, 'local');

      expect(whiteboardService.getElements().find((e) => e.id === 'sg-0-0')?.x).toBe(200);

      // 2. Undo move in 1 step
      whiteboardService.undo();
      expect(whiteboardService.getElements().find((e) => e.id === 'sg-0-0')?.x).toBe(0);

      // 3. Attempt to delete group 9 (contains 1 locked member)
      const g9Ids = whiteboardService.getElements().filter((e) => e.groupId === 'stress-group-9').map((e) => e.id);
      whiteboardService.deleteElements(g9Ids);

      // 4 unlocked members deleted, 1 locked member remains shielded
      const remainingG9 = whiteboardService.getElements().filter((e) => e.groupId === 'stress-group-9');
      expect(remainingG9).toHaveLength(1);
      expect(remainingG9[0].id).toBe('sg-9-4');
      expect(remainingG9[0].locked).toBe(true);

      // Total elements is now 50 - 4 = 46
      expect(whiteboardService.getElements()).toHaveLength(46);
    });
  });
});
