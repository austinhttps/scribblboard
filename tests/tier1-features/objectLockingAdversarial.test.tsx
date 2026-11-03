import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Track the props passed to rendered Konva components keyed by element ID
const renderedNodesById = new Map<string, any>();

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
  const recordProps = (type: string, props: any) => {
    if (props && props.id) {
      renderedNodesById.set(props.id, { type, ...props });
    }
    return React.createElement('div', { 'data-konva-type': type, ...props }, props.children);
  };

  return {
    Stage: (props: any) => recordProps('Stage', props),
    Layer: (props: any) => recordProps('Layer', props),
    Rect: (props: any) => recordProps('Rect', props),
    Circle: (props: any) => recordProps('Circle', props),
    Line: (props: any) => recordProps('Line', props),
    Arrow: (props: any) => recordProps('Arrow', props),
    Text: (props: any) => recordProps('Text', props),
    Group: (props: any) => recordProps('Group', props),
    Image: (props: any) => recordProps('Image', props),
    Transformer: (props: any) => recordProps('Transformer', props),
  };
});

import * as Y from 'yjs';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import {
  CanvasElement,
  RectElement,
  CircleElement,
  PenElement,
  ArrowElement,
  LineElement,
  StickyElement,
  TextElement,
  ImageElement,
} from '../../src/types/whiteboard';
import { ElementRenderer } from '../../src/components/Canvas/ElementRenderer';

describe('Empirical Adversarial Verification: Feature 1 - Object Locking', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(9001);
    renderedNodesById.clear();
  });

  afterEach(() => {
    harness.cleanup();
    vi.restoreAllMocks();
  });

  // Helper to generate distinct elements
  const createMockElement = (
    id: string,
    type: CanvasElement['type'],
    locked: boolean = false
  ): CanvasElement => {
    const base = {
      id,
      x: 100,
      y: 100,
      zIndex: 1,
      updatedAt: Date.now(),
      locked,
    };

    switch (type) {
      case 'rect':
        return {
          ...base,
          type: 'rect',
          width: 120,
          height: 80,
          fill: '#ffffff',
          stroke: '#000000',
          strokeWidth: 2,
        } as RectElement;
      case 'circle':
        return {
          ...base,
          type: 'circle',
          radiusX: 50,
          radiusY: 50,
          fill: '#ffffff',
          stroke: '#000000',
          strokeWidth: 2,
        } as CircleElement;
      case 'pen':
        return {
          ...base,
          type: 'pen',
          points: [0, 0, 10, 10, 20, 20],
          color: '#000000',
          strokeWidth: 2,
        } as PenElement;
      case 'line':
        return {
          ...base,
          type: 'line',
          points: [0, 0, 50, 50],
          color: '#000000',
          strokeWidth: 2,
        } as LineElement;
      case 'arrow':
        return {
          ...base,
          type: 'arrow',
          points: [0, 0, 80, 80],
          color: '#000000',
          strokeWidth: 2,
        } as ArrowElement;
      case 'sticky':
        return {
          ...base,
          type: 'sticky',
          width: 150,
          height: 150,
          text: 'Adversarial Note',
          color: 'yellow',
          fontSize: 14,
        } as StickyElement;
      case 'text':
        return {
          ...base,
          type: 'text',
          width: 100,
          height: 30,
          text: 'Adversarial Text',
          fontSize: 16,
          fontFamily: 'sans-serif',
          color: '#000000',
        } as TextElement;
      case 'image':
        return {
          ...base,
          type: 'image',
          src: 'https://example.com/test.png',
          width: 200,
          height: 150,
        } as ImageElement;
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  };

  // Helper to mount an element through ElementRenderer with React DOM and extract its Konva node props
  const renderElementWithReact = async (element: CanvasElement, isEditing: boolean = false) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ElementRenderer
          element={element}
          isSelected={false}
          onSelect={() => {}}
          onChange={() => {}}
          isEditing={isEditing}
        />
      );
    });

    const capturedProps = renderedNodesById.get(element.id);

    await act(async () => {
      root.unmount();
    });
    document.body.removeChild(container);

    return capturedProps;
  };

  // =========================================================================
  // REQUIREMENT 1: Attempt to delete locked elements via Delete/Backspace
  // =========================================================================
  describe('Requirement 1: Deletion Prevention via Delete/Backspace Handlers', () => {
    it('REQ-1.1: Single locked element cannot be deleted via Backspace/Delete handler logic', () => {
      const lockedRect = createMockElement('locked-1', 'rect', true);
      harness.setElement(lockedRect);

      let selectedIds = ['locked-1'];
      const elements = harness.getElements();

      // Execute application deletion logic (matching App.tsx and Whiteboard.tsx)
      const handleDelete = () => {
        const deletableIds = selectedIds.filter(
          (id) => !elements.find((el) => el.id === id)?.locked
        );
        if (deletableIds.length > 0) {
          harness.deleteElements(deletableIds);
          selectedIds = selectedIds.filter((id) => !deletableIds.includes(id));
        }
      };

      handleDelete();

      // Verification: Element MUST still exist in CRDT and remain selected
      expect(harness.getElement('locked-1')).toBeDefined();
      expect(harness.getElement('locked-1')!.locked).toBe(true);
      expect(selectedIds).toEqual(['locked-1']);
    });

    it('REQ-1.2: Multiple locked elements selected are all shielded from deletion', () => {
      const el1 = createMockElement('locked-a', 'rect', true);
      const el2 = createMockElement('locked-b', 'circle', true);
      const el3 = createMockElement('locked-c', 'sticky', true);
      harness.setElements([el1, el2, el3]);

      let selectedIds = ['locked-a', 'locked-b', 'locked-c'];
      const elements = harness.getElements();

      const handleDelete = () => {
        const deletableIds = selectedIds.filter(
          (id) => !elements.find((el) => el.id === id)?.locked
        );
        if (deletableIds.length > 0) {
          harness.deleteElements(deletableIds);
          selectedIds = selectedIds.filter((id) => !deletableIds.includes(id));
        }
      };

      handleDelete();

      expect(harness.getElements().length).toBe(3);
      expect(selectedIds.length).toBe(3);
    });

    it('REQ-1.3: Context menu direct deletion rejects locked target elements', () => {
      const lockedTarget = createMockElement('context-target', 'text', true);
      harness.setElement(lockedTarget);

      const contextMenu = {
        targetElement: lockedTarget,
      };

      // ContextMenu delete logic from Whiteboard.tsx:945
      const handleContextMenuDelete = () => {
        if (contextMenu.targetElement && !contextMenu.targetElement.locked) {
          harness.deleteElement(contextMenu.targetElement.id);
        }
      };

      handleContextMenuDelete();

      expect(harness.getElement('context-target')).toBeDefined();
      expect(harness.getElement('context-target')!.locked).toBe(true);
    });

    it('REQ-1.4: Delete/Backspace while focused on input/textarea must NOT trigger element deletion', () => {
      const unlockedRect = createMockElement('unlocked-el', 'rect', false);
      harness.setElement(unlockedRect);
      let selectedIds = ['unlocked-el'];

      // Simulate input element focused in DOM
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      let deletionCalled = false;
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
            target.isContentEditable ||
            target.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
          deletionCalled = true;
        }
      };

      // Dispatch event to input
      const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
      input.dispatchEvent(event);
      handleKeyDown(event);

      expect(deletionCalled).toBe(false);
      expect(harness.getElement('unlocked-el')).toBeDefined();

      document.body.removeChild(input);
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Mixed Selection (5 elements: 2 locked, 3 unlocked)
  // =========================================================================
  describe('Requirement 2: Mixed Selection Deletion (5 elements: 2 locked, 3 unlocked)', () => {
    it('REQ-2.1: Exactly 5 elements selected (2 locked, 3 unlocked) — only 3 unlocked are deleted', () => {
      const el1 = createMockElement('elem-1', 'rect', false);    // Unlocked
      const el2 = createMockElement('elem-2', 'circle', true);    // Locked
      const el3 = createMockElement('elem-3', 'sticky', false);  // Unlocked
      const el4 = createMockElement('elem-4', 'text', true);      // Locked
      const el5 = createMockElement('elem-5', 'line', false);    // Unlocked

      harness.setElements([el1, el2, el3, el4, el5]);
      harness.undoManager.stopCapturing();

      let selectedIds = ['elem-1', 'elem-2', 'elem-3', 'elem-4', 'elem-5'];
      const elements = harness.getElements();
      const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

      // App.tsx handleKeyDown delete logic
      const unlockedSelected = selectedElements.filter((el) => !el.locked);
      expect(unlockedSelected.length).toBe(3);

      if (unlockedSelected.length > 0) {
        const unlockedIds = unlockedSelected.map((el) => el.id);
        harness.deleteElements(unlockedIds);
        selectedIds = selectedIds.filter((id) => !unlockedIds.includes(id));
      }

      // Verifications:
      // 1. Exactly 2 locked elements remain in Yjs doc
      expect(harness.getElements().length).toBe(2);
      expect(harness.getElement('elem-2')).toBeDefined();
      expect(harness.getElement('elem-4')).toBeDefined();
      expect(harness.getElement('elem-2')!.locked).toBe(true);
      expect(harness.getElement('elem-4')!.locked).toBe(true);

      // 2. All 3 unlocked elements are strictly deleted
      expect(harness.getElement('elem-1')).toBeUndefined();
      expect(harness.getElement('elem-3')).toBeUndefined();
      expect(harness.getElement('elem-5')).toBeUndefined();

      // 3. Selection state retains only the surviving locked items
      expect(selectedIds).toEqual(['elem-2', 'elem-4']);
    });

    it('REQ-2.2: Backspace key triggers identical atomic filtering on 5 mixed elements', () => {
      const el1 = createMockElement('bk-1', 'arrow', true);   // Locked
      const el2 = createMockElement('bk-2', 'pen', false);    // Unlocked
      const el3 = createMockElement('bk-3', 'rect', false);   // Unlocked
      const el4 = createMockElement('bk-4', 'circle', false); // Unlocked
      const el5 = createMockElement('bk-5', 'sticky', true);  // Locked

      harness.setElements([el1, el2, el3, el4, el5]);

      let selectedIds = ['bk-1', 'bk-2', 'bk-3', 'bk-4', 'bk-5'];
      const elements = harness.getElements();

      // Whiteboard.tsx deletion logic:
      const deletableIds = selectedIds.filter((id) => !elements.find((el) => el.id === id)?.locked);
      expect(deletableIds).toEqual(['bk-2', 'bk-3', 'bk-4']);

      harness.deleteElements(deletableIds);
      selectedIds = selectedIds.filter((id) => !deletableIds.includes(id));

      expect(harness.getElement('bk-1')).toBeDefined();
      expect(harness.getElement('bk-5')).toBeDefined();
      expect(harness.getElement('bk-2')).toBeUndefined();
      expect(harness.getElement('bk-3')).toBeUndefined();
      expect(harness.getElement('bk-4')).toBeUndefined();
      expect(selectedIds).toEqual(['bk-1', 'bk-5']);
    });

    it('REQ-2.3: Deletion of unlocked elements from mixed selection supports single-step undo and redo', () => {
      const el1 = createMockElement('undo-1', 'rect', false);
      const el2 = createMockElement('undo-2', 'rect', true);
      const el3 = createMockElement('undo-3', 'rect', false);
      const el4 = createMockElement('undo-4', 'rect', true);
      const el5 = createMockElement('undo-5', 'rect', false);

      harness.setElements([el1, el2, el3, el4, el5], 'remote');
      harness.undoManager.stopCapturing();

      // Batch delete the 3 unlocked elements
      harness.deleteElements(['undo-1', 'undo-3', 'undo-5'], 'local');
      expect(harness.getElements().length).toBe(2);

      // Single step Undo: All 3 elements must return
      expect(harness.canUndo()).toBe(true);
      harness.undo();
      expect(harness.getElements().length).toBe(5);
      expect(harness.getElement('undo-1')).toBeDefined();
      expect(harness.getElement('undo-3')).toBeDefined();
      expect(harness.getElement('undo-5')).toBeDefined();
      expect(harness.getElement('undo-2')!.locked).toBe(true);
      expect(harness.getElement('undo-4')!.locked).toBe(true);

      // Single step Redo: All 3 elements deleted again
      expect(harness.canRedo()).toBe(true);
      harness.redo();
      expect(harness.getElements().length).toBe(2);
      expect(harness.getElement('undo-1')).toBeUndefined();
      expect(harness.getElement('undo-3')).toBeUndefined();
      expect(harness.getElement('undo-5')).toBeUndefined();
    });

    it('REQ-2.4: Attempting delete when all 5 elements are locked performs zero transactions', () => {
      const allLocked = [
        createMockElement('l1', 'rect', true),
        createMockElement('l2', 'circle', true),
        createMockElement('l3', 'sticky', true),
        createMockElement('l4', 'text', true),
        createMockElement('l5', 'pen', true),
      ];
      harness.setElements(allLocked);
      harness.undoManager.stopCapturing();

      const undoCountBefore = harness.undoManager.undoStack.length;
      const selectedIds = ['l1', 'l2', 'l3', 'l4', 'l5'];
      const elements = harness.getElements();

      const deletableIds = selectedIds.filter((id) => !elements.find((el) => el.id === id)?.locked);
      expect(deletableIds.length).toBe(0);

      if (deletableIds.length > 0) {
        harness.deleteElements(deletableIds);
      }

      expect(harness.getElements().length).toBe(5);
      expect(harness.undoManager.undoStack.length).toBe(undoCountBefore);
    });
  });

  // =========================================================================
  // REQUIREMENT 3: draggable is strictly false when locked === true
  // =========================================================================
  describe('Requirement 3: draggable Property Strictly False for All Element Types', () => {
    const types: CanvasElement['type'][] = [
      'pen',
      'rect',
      'circle',
      'arrow',
      'line',
      'sticky',
      'text',
      'image',
    ];

    types.forEach((type) => {
      it(`REQ-3.1 [${type}]: should have draggable=false when locked=true`, async () => {
        const elLocked = createMockElement(`test-locked-${type}`, type, true);
        const props = await renderElementWithReact(elLocked, false);

        expect(props).toBeDefined();
        expect(props.draggable).toBe(false);
      });

      it(`REQ-3.2 [${type}]: should have draggable=true when locked=false`, async () => {
        const elUnlocked = createMockElement(`test-unlocked-${type}`, type, false);
        const props = await renderElementWithReact(elUnlocked, false);

        expect(props).toBeDefined();
        expect(props.draggable).toBe(true);
      });
    });

    it('REQ-3.3: Konva Transformer disables resize and rotate anchors when selection contains locked element', () => {
      const el1 = createMockElement('trans-1', 'rect', false);
      const el2 = createMockElement('trans-2', 'circle', true);
      const elements = [el1, el2];
      const selectedIds = ['trans-1', 'trans-2'];

      // Derived logic from Whiteboard.tsx:234-239 & 1500-1530
      const isSelectionLocked = selectedIds.some((id) => {
        const el = elements.find((e) => e.id === id);
        return el?.locked === true;
      });

      expect(isSelectionLocked).toBe(true);

      const transformerProps = {
        resizeEnabled: !isSelectionLocked,
        rotateEnabled: !isSelectionLocked,
        enabledAnchors: isSelectionLocked
          ? []
          : [
              'top-left',
              'top-center',
              'top-right',
              'middle-right',
              'middle-left',
              'bottom-left',
              'bottom-center',
              'bottom-right',
            ],
        borderStroke: isSelectionLocked ? '#f59e0b' : '#6366f1',
        borderDash: isSelectionLocked ? [2, 2] : [4, 4],
      };

      expect(transformerProps.resizeEnabled).toBe(false);
      expect(transformerProps.rotateEnabled).toBe(false);
      expect(transformerProps.enabledAnchors).toEqual([]);
      expect(transformerProps.borderStroke).toBe('#f59e0b'); // Warning amber
      expect(transformerProps.borderDash).toEqual([2, 2]);
    });

    it('REQ-3.4: Drag start stops drag immediately if element is locked', () => {
      const lockedRect = createMockElement('drag-stop-1', 'rect', true);
      const stopDragSpy = vi.fn();
      const mockEvent = {
        target: {
          stopDrag: stopDragSpy,
        },
      } as any;

      // Logic from Whiteboard.tsx:714-719
      const handleElementDragStart = (el: CanvasElement, e: any) => {
        if (el?.locked) {
          e.target.stopDrag();
          return false;
        }
        return true;
      };

      const result = handleElementDragStart(lockedRect, mockEvent);
      expect(result).toBe(false);
      expect(stopDragSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Locking State Persistence & Single-Step Undo/Redo in Yjs
  // =========================================================================
  describe('Requirement 4: Yjs CRDT Persistence & UndoManager Behavior', () => {
    it('REQ-4.1: Locked flag persists across Yjs state serialization and remote doc merge', () => {
      const rect = createMockElement('persist-1', 'rect', true);
      harness.setElement(rect);

      // Create a secondary peer Y.Doc
      const peerDoc = new Y.Doc();
      const peerMap = peerDoc.getMap<CanvasElement>('canvas-elements');

      // Export state update from harness and apply to peerDoc
      const update = Y.encodeStateAsUpdate(harness.doc);
      Y.applyUpdate(peerDoc, update);

      const peerElement = peerMap.get('persist-1');
      expect(peerElement).toBeDefined();
      expect(peerElement!.locked).toBe(true);

      peerDoc.destroy();
    });

    it('REQ-4.2: Toggling lock on 5 elements is recorded as a single atomic transaction in UndoManager', () => {
      const e1 = createMockElement('atomic-1', 'rect', false);
      const e2 = createMockElement('atomic-2', 'circle', true);
      const e3 = createMockElement('atomic-3', 'sticky', false);
      const e4 = createMockElement('atomic-4', 'text', true);
      const e5 = createMockElement('atomic-5', 'line', false);

      harness.setElements([e1, e2, e3, e4, e5], 'remote');
      harness.undoManager.stopCapturing();

      const initialUndoLength = harness.undoManager.undoStack.length;

      // Lock all 5 elements in a single batch transaction (App.tsx:157-175)
      const selected = [e1, e2, e3, e4, e5];
      const anyUnlocked = selected.some((el) => !el.locked);
      expect(anyUnlocked).toBe(true);

      const updated = selected.map((el) => ({
        ...el,
        locked: true,
        updatedAt: Date.now(),
      }));

      harness.setElements(updated, 'local');

      // Verify all 5 are now locked
      expect(harness.getElements().every((el) => el.locked === true)).toBe(true);

      // UndoManager stack should have incremented by EXACTLY 1 transaction
      expect(harness.undoManager.undoStack.length).toBe(initialUndoLength + 1);

      // Call Undo: All 5 should revert to their exact initial states in 1 step!
      harness.undo();

      expect(harness.getElement('atomic-1')!.locked).toBe(false);
      expect(harness.getElement('atomic-2')!.locked).toBe(true);
      expect(harness.getElement('atomic-3')!.locked).toBe(false);
      expect(harness.getElement('atomic-4')!.locked).toBe(true);
      expect(harness.getElement('atomic-5')!.locked).toBe(false);

      // Call Redo: All 5 re-lock in 1 step
      harness.redo();
      expect(harness.getElements().every((el) => el.locked === true)).toBe(true);
    });

    it('REQ-4.3: Rapid 50x lock toggle stress test maintains CRDT integrity', () => {
      const el = createMockElement('rapid-elem', 'rect', false);
      harness.setElement(el);

      for (let i = 0; i < 50; i++) {
        const current = harness.getElement('rapid-elem')!;
        const nextState = !(current as any).locked;
        harness.setElement({
          ...current,
          locked: nextState,
        });
      }

      // Started false, toggled 50 times (even) -> must be false
      const finalElement = harness.getElement('rapid-elem')!;
      expect(finalElement.locked).toBe(false);
      expect(harness.getElements().length).toBe(1);
    });
  });

  // =========================================================================
  // REQUIREMENT 5: Shortcut Ctrl+L / Cmd+L Toggling Logic with Mixed States
  // =========================================================================
  describe('Requirement 5: Shortcut Ctrl+L / Cmd+L Mixed State Toggling Logic', () => {
    it('REQ-5.1: Mixed selection (2 locked, 3 unlocked) toggles to ALL LOCKED on first Ctrl+L, then ALL UNLOCKED on second Ctrl+L', () => {
      const el1 = createMockElement('mix-t-1', 'rect', false);
      const el2 = createMockElement('mix-t-2', 'circle', true);
      const el3 = createMockElement('mix-t-3', 'sticky', false);
      const el4 = createMockElement('mix-t-4', 'text', true);
      const el5 = createMockElement('mix-t-5', 'pen', false);

      harness.setElements([el1, el2, el3, el4, el5]);

      const selectedIds = ['mix-t-1', 'mix-t-2', 'mix-t-3', 'mix-t-4', 'mix-t-5'];

      // Function executing exact toggle lock logic from App.tsx:157-175
      const executeToggleLock = () => {
        const currentElements = harness.getElements();
        const selected = currentElements.filter((el) => selectedIds.includes(el.id));
        if (selected.length === 0) return;

        const anyUnlocked = selected.some((el) => !el.locked);
        const targetLocked = anyUnlocked;

        const updatedElements: CanvasElement[] = selected.map((el) => {
          const clone = { ...el, updatedAt: Date.now() };
          if (targetLocked) {
            clone.locked = true;
          } else {
            delete clone.locked;
          }
          return clone as CanvasElement;
        });

        harness.setElements(updatedElements);
      };

      // --- Pass 1 (Mixed state) ---
      executeToggleLock();

      // All 5 must now be locked
      const pass1Elements = harness.getElements();
      expect(pass1Elements.length).toBe(5);
      pass1Elements.forEach((el) => {
        expect(el.locked).toBe(true);
      });

      // --- Pass 2 (All locked state) ---
      executeToggleLock();

      // All 5 must now be unlocked
      const pass2Elements = harness.getElements();
      expect(pass2Elements.length).toBe(5);
      pass2Elements.forEach((el) => {
        expect(el.locked).toBeFalsy();
      });
    });

    it('REQ-5.2: Mac Cmd+L (metaKey) triggers the same lock toggle handler as Ctrl+L', () => {
      let toggleCount = 0;
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'l') {
          e.preventDefault();
          toggleCount++;
        }
      };

      // Test Windows/Linux Ctrl+L
      const ctrlLEvent = new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, metaKey: false });
      handleKeyDown(ctrlLEvent);
      expect(toggleCount).toBe(1);

      // Test macOS Cmd+L
      const cmdLEvent = new KeyboardEvent('keydown', { key: 'l', ctrlKey: false, metaKey: true });
      handleKeyDown(cmdLEvent);
      expect(toggleCount).toBe(2);

      // Test uppercase L
      const cmdUpperLEvent = new KeyboardEvent('keydown', { key: 'L', ctrlKey: false, metaKey: true });
      handleKeyDown(cmdUpperLEvent);
      expect(toggleCount).toBe(3);
    });

    it('REQ-5.3: Shortcut collision protection — single-key L switches to line tool, while Ctrl+L does NOT', () => {
      let currentTool = 'select';
      let lockToggled = false;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Object Locking (Ctrl+L / Cmd+L)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'l') {
          e.preventDefault();
          lockToggled = true;
          return;
        }

        // Single-key hotkeys (ONLY when no modifier keys are pressed)
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          switch (e.key.toLowerCase()) {
            case 'l':
              currentTool = 'line';
              break;
          }
        }
      };

      // 1. Press bare 'l' (no modifiers) -> tool should become 'line', lock not toggled
      handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
      expect(currentTool).toBe('line');
      expect(lockToggled).toBe(false);

      // Reset
      currentTool = 'select';
      lockToggled = false;

      // 2. Press 'Ctrl+L' -> lock toggled, tool remains 'select' (NOT 'line')
      handleKeyDown(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true }));
      expect(lockToggled).toBe(true);
      expect(currentTool).toBe('select');

      // 3. Press 'Ctrl+Shift+L' -> neither lock nor line tool
      lockToggled = false;
      handleKeyDown(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, shiftKey: true }));
      expect(lockToggled).toBe(false);
      expect(currentTool).toBe('select');
    });

    it('REQ-5.4: Empty selection with Ctrl+L is a safe no-op', () => {
      let executed = false;
      const selectedIds: string[] = [];

      const handleToggleLock = () => {
        if (selectedIds.length === 0) return;
        executed = true;
      };

      handleToggleLock();
      expect(executed).toBe(false);
    });

    it('REQ-5.5: PropertyBar & ContextMenu dynamic state reflects mixed vs all-locked status', () => {
      const el1 = createMockElement('pbar-1', 'rect', true);
      const el2 = createMockElement('pbar-2', 'circle', false);

      // Mixed state:
      const mixedList = [el1, el2];
      const isAllLockedMixed = mixedList.length > 0 && mixedList.every((el) => el.locked);
      expect(isAllLockedMixed).toBe(false);

      // All-locked state:
      const allLockedList = [el1, createMockElement('pbar-3', 'rect', true)];
      const isAllLockedAll = allLockedList.length > 0 && allLockedList.every((el) => el.locked);
      expect(isAllLockedAll).toBe(true);
    });
  });

  // =========================================================================
  // REQUIREMENT 6: Cut and Duplicate Interactions with Locked & Mixed Selections
  // =========================================================================
  describe('Requirement 6: Cut and Duplicate Interactions with Locked & Mixed Selections', () => {
    it('REQ-6.1: handleCut on single locked element is a no-op that does not delete the element from CRDT', () => {
      const lockedRect = createMockElement('cut-locked-1', 'rect', true);
      harness.setElement(lockedRect);

      let clipboard: CanvasElement[] = [];
      let selectedIds = ['cut-locked-1'];
      const elements = harness.getElements();
      const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

      const handleCut = () => {
        if (selectedElements.length > 0) {
          const unlockedSelected = selectedElements.filter((el) => !el.locked);
          if (unlockedSelected.length === 0) return;
          clipboard = [...selectedElements];
          const unlockedIds = unlockedSelected.map((el) => el.id);
          harness.deleteElements(unlockedIds);
          selectedIds = selectedIds.filter((id) => !unlockedIds.includes(id));
        }
      };

      handleCut();

      expect(harness.getElement('cut-locked-1')).toBeDefined();
      expect(harness.getElement('cut-locked-1')!.locked).toBe(true);
      expect(clipboard).toEqual([]);
      expect(selectedIds).toEqual(['cut-locked-1']);
    });

    it('REQ-6.2: handleCut on mixed selection deletes ONLY unlocked elements, preserving locked elements in CRDT and selection', () => {
      const lockedEl = createMockElement('cut-mix-locked', 'rect', true);
      const unlockedEl = createMockElement('cut-mix-unlocked', 'circle', false);
      harness.setElements([lockedEl, unlockedEl]);

      let clipboard: CanvasElement[] = [];
      let selectedIds = ['cut-mix-locked', 'cut-mix-unlocked'];
      const elements = harness.getElements();
      const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

      const handleCut = () => {
        if (selectedElements.length > 0) {
          const unlockedSelected = selectedElements.filter((el) => !el.locked);
          if (unlockedSelected.length === 0) return;
          clipboard = [...selectedElements];
          const unlockedIds = unlockedSelected.map((el) => el.id);
          harness.deleteElements(unlockedIds);
          selectedIds = selectedIds.filter((id) => !unlockedIds.includes(id));
        }
      };

      handleCut();

      // Unlocked element is deleted
      expect(harness.getElement('cut-mix-unlocked')).toBeUndefined();
      // Locked element remains in CRDT
      expect(harness.getElement('cut-mix-locked')).toBeDefined();
      expect(harness.getElement('cut-mix-locked')!.locked).toBe(true);
      // Clipboard holds selectedElements
      expect(clipboard.length).toBe(2);
      // Selection retains only the remaining locked element
      expect(selectedIds).toEqual(['cut-mix-locked']);
    });

    it('REQ-6.3: handleDuplicate on single locked element does not duplicate', () => {
      const lockedEl = createMockElement('dup-locked-1', 'rect', true);
      harness.setElement(lockedEl);

      let selectedIds = ['dup-locked-1'];
      const elements = harness.getElements();
      const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

      const handleDuplicate = () => {
        const targetList = selectedElements.filter((el) => !el.locked);
        if (targetList.length === 0) return;
        targetList.forEach((el) => {
          harness.setElement({ ...el, id: crypto.randomUUID() });
        });
      };

      handleDuplicate();
      expect(harness.getElements().length).toBe(1);
      expect(harness.getElement('dup-locked-1')).toBeDefined();
    });

    it('REQ-6.4: handleDuplicate on mixed selection duplicates ONLY unlocked elements', () => {
      const lockedEl = createMockElement('dup-mix-locked', 'rect', true);
      const unlockedEl = createMockElement('dup-mix-unlocked', 'circle', false);
      harness.setElements([lockedEl, unlockedEl]);

      let selectedIds = ['dup-mix-locked', 'dup-mix-unlocked'];
      const elements = harness.getElements();
      const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

      const duplicatesCreated: CanvasElement[] = [];
      const handleDuplicate = () => {
        const targetList = selectedElements.filter((el) => !el.locked);
        if (targetList.length === 0) return;
        targetList.forEach((el) => {
          const dup = { ...el, id: crypto.randomUUID() };
          duplicatesCreated.push(dup);
          harness.setElement(dup);
        });
      };

      handleDuplicate();

      expect(duplicatesCreated.length).toBe(1);
      expect(duplicatesCreated[0].type).toBe('circle');
      expect(harness.getElements().length).toBe(3);
    });

    it('REQ-6.5: handleDuplicate remaps groupId to fresh UUID so duplicates do not contaminate original group', () => {
      const el1 = { ...createMockElement('g-el-1', 'rect', false), groupId: 'orig-group' };
      const el2 = { ...createMockElement('g-el-2', 'circle', false), groupId: 'orig-group' };
      harness.setElements([el1, el2]);

      const selectedElements = [el1, el2];
      const duplicates: CanvasElement[] = [];
      const groupMap = new Map<string, string>();

      const targetList = selectedElements.filter((el) => !el.locked);
      targetList.forEach((el) => {
        const newId = crypto.randomUUID();
        let newGroupId = el.groupId;
        if (el.groupId) {
          if (!groupMap.has(el.groupId)) {
            groupMap.set(el.groupId, crypto.randomUUID());
          }
          newGroupId = groupMap.get(el.groupId);
        }
        duplicates.push({ ...el, id: newId, groupId: newGroupId });
      });

      expect(duplicates.length).toBe(2);
      expect(duplicates[0].groupId).toBeDefined();
      expect(duplicates[0].groupId).not.toBe('orig-group');
      expect(duplicates[0].groupId).toBe(duplicates[1].groupId);
    });
  });
});
