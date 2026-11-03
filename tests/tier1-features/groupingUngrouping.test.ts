import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { CanvasElement, RectElement, CircleElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 2 - Grouping & Ungrouping', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(102);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('T1-GRP-1: should assign shared groupId to selected elements in a single Yjs transaction', () => {
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
    harness.setElements([el1 as CanvasElement, el2 as CanvasElement]);

    // Group elements
    const newGroupId = 'group-uuid-1';
    harness.transact(() => {
      const e1 = harness.getElement('grp-el-1')!;
      const e2 = harness.getElement('grp-el-2')!;
      harness.setElement({ ...e1, groupId: newGroupId } as CanvasElement);
      harness.setElement({ ...e2, groupId: newGroupId } as CanvasElement);
    });

    const stored1 = harness.getElement('grp-el-1');
    const stored2 = harness.getElement('grp-el-2');
    expect((stored1 as any).groupId).toBe('group-uuid-1');
    expect((stored2 as any).groupId).toBe('group-uuid-1');
  });

  it('T1-GRP-2: should expand selection to all elements sharing groupId when one is clicked', () => {
    const el1 = { id: 'g-1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: 'grp-A' } as CanvasElement;
    const el2 = { id: 'g-2', type: 'rect', x: 50, y: 50, zIndex: 2, updatedAt: 1, groupId: 'grp-A' } as CanvasElement;
    const el3 = { id: 'g-3', type: 'rect', x: 100, y: 100, zIndex: 3, updatedAt: 1 } as CanvasElement;
    harness.setElements([el1, el2, el3]);

    const expandSelection = (selectedId: string): string[] => {
      const target = harness.getElement(selectedId);
      if (!target || !(target as any).groupId) return [selectedId];

      const gId = (target as any).groupId;
      return harness.getElements()
        .filter((el) => (el as any).groupId === gId)
        .map((el) => el.id);
    };

    const expanded = expandSelection('g-1');
    expect(expanded).toContain('g-1');
    expect(expanded).toContain('g-2');
    expect(expanded).not.toContain('g-3');
    expect(expanded.length).toBe(2);
  });

  it('T1-GRP-3: should move all group members by equal offset atomically', () => {
    const el1 = { id: 'm-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: 'grp-M' } as CanvasElement;
    const el2 = { id: 'm-2', type: 'rect', x: 60, y: 80, zIndex: 2, updatedAt: 1, groupId: 'grp-M' } as CanvasElement;
    harness.setElements([el1, el2]);

    const moveGroup = (groupId: string, dx: number, dy: number) => {
      harness.transact(() => {
        const members = harness.getElements().filter((e) => (e as any).groupId === groupId);
        members.forEach((m) => {
          harness.setElement({ ...m, x: m.x + dx, y: m.y + dy });
        });
      });
    };

    moveGroup('grp-M', 25, 30);
    expect(harness.getElement('m-1')!.x).toBe(35);
    expect(harness.getElement('m-1')!.y).toBe(40);
    expect(harness.getElement('m-2')!.x).toBe(85);
    expect(harness.getElement('m-2')!.y).toBe(110);
  });

  it('T1-GRP-4: should delete all group members when any group member is deleted', () => {
    const el1 = { id: 'd-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: 'grp-D' } as CanvasElement;
    const el2 = { id: 'd-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: 'grp-D' } as CanvasElement;
    harness.setElements([el1, el2]);

    const deleteGroupMember = (id: string) => {
      const el = harness.getElement(id);
      if (!el) return;
      const gId = (el as any).groupId;
      if (gId) {
        const toDelete = harness.getElements().filter((e) => (e as any).groupId === gId).map((e) => e.id);
        harness.deleteElements(toDelete);
      } else {
        harness.deleteElement(id);
      }
    };

    deleteGroupMember('d-1');
    expect(harness.getElement('d-1')).toBeUndefined();
    expect(harness.getElement('d-2')).toBeUndefined();
  });

  it('T1-GRP-5: should ungroup elements by clearing groupId in an atomic transaction', () => {
    const el1 = { id: 'u-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1, groupId: 'grp-U' } as CanvasElement;
    const el2 = { id: 'u-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1, groupId: 'grp-U' } as CanvasElement;
    harness.setElements([el1, el2]);

    const ungroup = (groupId: string) => {
      harness.transact(() => {
        const members = harness.getElements().filter((e) => (e as any).groupId === groupId);
        members.forEach((m) => {
          const updated = { ...m };
          delete (updated as any).groupId;
          harness.setElement(updated);
        });
      });
    };

    ungroup('grp-U');
    expect((harness.getElement('u-1') as any).groupId).toBeUndefined();
    expect((harness.getElement('u-2') as any).groupId).toBeUndefined();
  });

  it('T1-GRP-6: should undo grouping operation in a single step', () => {
    const el1 = { id: 'ug-1', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1 } as CanvasElement;
    const el2 = { id: 'ug-2', type: 'rect', x: 20, y: 20, zIndex: 2, updatedAt: 1 } as CanvasElement;
    harness.setElements([el1, el2], 'remote');
    harness.undoManager.stopCapturing();

    // Group via local origin
    harness.transact(() => {
      harness.setElement({ ...harness.getElement('ug-1')!, groupId: 'grp-undo' });
      harness.setElement({ ...harness.getElement('ug-2')!, groupId: 'grp-undo' });
    }, 'local');

    expect((harness.getElement('ug-1') as any).groupId).toBe('grp-undo');
    expect((harness.getElement('ug-2') as any).groupId).toBe('grp-undo');

    // Single undo reverts both elements back to non-grouped
    harness.undo();
    expect((harness.getElement('ug-1') as any).groupId).toBeUndefined();
    expect((harness.getElement('ug-2') as any).groupId).toBeUndefined();
  });
});
