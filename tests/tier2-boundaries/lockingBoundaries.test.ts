import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 2: Boundary & Corner Cases - Object Locking', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(201);
  });

  afterEach(() => {
    harness.cleanup();
  });

  const createRect = (id: string, x: number, y: number, locked: boolean = false): RectElement => ({
    id,
    type: 'rect',
    x,
    y,
    width: 100,
    height: 100,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    zIndex: 1,
    updatedAt: Date.now(),
    locked,
  });

  it('T2-LOCK-1: Toggle lock on empty selection array should be a safe no-op', () => {
    const toggleSelectionLock = (selectedIds: string[]) => {
      if (selectedIds.length === 0) return;
      harness.transact(() => {
        selectedIds.forEach((id) => {
          const el = harness.getElement(id);
          if (el) harness.setElement({ ...el, locked: !(el as any).locked });
        });
      });
    };

    expect(() => toggleSelectionLock([])).not.toThrow();
    expect(harness.getElements().length).toBe(0);
  });

  it('T2-LOCK-2: Toggle lock on mixed selection (some locked, some unlocked) should lock all or invert consistently', () => {
    const r1 = createRect('mix-1', 10, 10, false);
    const r2 = createRect('mix-2', 150, 150, true);
    harness.setElements([r1 as CanvasElement, r2 as CanvasElement]);

    // Standard pattern: if any are unlocked, lock all; otherwise unlock all
    const toggleMixedLock = (selectedIds: string[]) => {
      const selected = selectedIds.map((id) => harness.getElement(id)).filter(Boolean) as CanvasElement[];
      const hasUnlocked = selected.some((el) => !(el as any).locked);
      const targetState = hasUnlocked;

      harness.transact(() => {
        selected.forEach((el) => {
          harness.setElement({ ...el, locked: targetState });
        });
      });
    };

    // First toggle: mix-1 is unlocked -> both should become locked
    toggleMixedLock(['mix-1', 'mix-2']);
    expect((harness.getElement('mix-1') as any).locked).toBe(true);
    expect((harness.getElement('mix-2') as any).locked).toBe(true);

    // Second toggle: all locked -> both should become unlocked
    toggleMixedLock(['mix-1', 'mix-2']);
    expect((harness.getElement('mix-1') as any).locked).toBe(false);
    expect((harness.getElement('mix-2') as any).locked).toBe(false);
  });

  it('T2-LOCK-3: Batch delete should delete unlocked elements while preserving locked ones', () => {
    const r1 = createRect('del-1', 0, 0, false);
    const r2 = createRect('del-2', 50, 50, true);  // locked
    const r3 = createRect('del-3', 100, 100, false);
    harness.setElements([r1 as CanvasElement, r2 as CanvasElement, r3 as CanvasElement]);

    const safeBatchDelete = (ids: string[]) => {
      const deletableIds = ids.filter((id) => {
        const el = harness.getElement(id);
        return el && !(el as any).locked;
      });
      harness.deleteElements(deletableIds);
    };

    safeBatchDelete(['del-1', 'del-2', 'del-3']);

    expect(harness.getElement('del-1')).toBeUndefined();
    expect(harness.getElement('del-2')).toBeDefined(); // preserved!
    expect(harness.getElement('del-3')).toBeUndefined();
  });

  it('T2-LOCK-4: Locked element with zero dimensions and negative coordinates handles safely', () => {
    const r = createRect('zero-dim', -500, -300, true);
    r.width = 0;
    r.height = 0;
    harness.setElement(r as CanvasElement);

    const stored = harness.getElement('zero-dim') as any;
    expect(stored.locked).toBe(true);
    expect(stored.width).toBe(0);
    expect(stored.x).toBe(-500);
  });

  it('T2-LOCK-5: Rapid duplicate lock toggles preserve consistency', () => {
    const r = createRect('rapid-lock', 10, 10, false);
    harness.setElement(r as CanvasElement);

    for (let i = 0; i < 10; i++) {
      const el = harness.getElement('rapid-lock')!;
      harness.setElement({ ...el, locked: !(el as any).locked });
    }

    // 10 toggles from false -> ends on false
    expect((harness.getElement('rapid-lock') as any).locked).toBe(false);
  });

  it('T2-LOCK-6: Clear all operation can be undone via Yjs UndoManager', () => {
    const r1 = createRect('ca-1', 0, 0, true);
    const r2 = createRect('ca-2', 50, 50, false);
    harness.setElements([r1 as CanvasElement, r2 as CanvasElement], 'remote');
    harness.undoManager.stopCapturing();

    harness.clearAll('local');
    expect(harness.getElements().length).toBe(0);

    // Undo restores elements
    harness.undo();
    expect(harness.getElements().length).toBe(2);
    expect((harness.getElement('ca-1') as any).locked).toBe(true);
  });
});
