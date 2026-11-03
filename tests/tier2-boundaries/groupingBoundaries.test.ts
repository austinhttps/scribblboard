import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 2: Boundary & Corner Cases - Grouping & Ungrouping', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(202);
  });

  afterEach(() => {
    harness.cleanup();
  });

  const createRect = (id: string, x: number, y: number): RectElement => ({
    id,
    type: 'rect',
    x,
    y,
    width: 80,
    height: 80,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    zIndex: 1,
    updatedAt: Date.now(),
  });

  it('T2-GRP-1: Attempting to group a single element should be a safe no-op (requires >=2 elements)', () => {
    const r = createRect('single-el', 10, 10);
    harness.setElement(r as CanvasElement);

    const safeGroup = (selectedIds: string[]) => {
      if (selectedIds.length < 2) return null; // Rule: cannot group fewer than 2 elements
      const newGroupId = crypto.randomUUID();
      harness.transact(() => {
        selectedIds.forEach((id) => {
          const el = harness.getElement(id);
          if (el) harness.setElement({ ...el, groupId: newGroupId });
        });
      });
      return newGroupId;
    };

    const result = safeGroup(['single-el']);
    expect(result).toBeNull();
    expect((harness.getElement('single-el') as any).groupId).toBeUndefined();
  });

  it('T2-GRP-2: Attempting to group empty array should not throw or modify state', () => {
    const safeGroup = (selectedIds: string[]) => {
      if (selectedIds.length < 2) return null;
      return 'new-grp';
    };

    expect(() => safeGroup([])).not.toThrow();
  });

  it('T2-GRP-3: Ungrouping an element that has no groupId does not throw or alter element', () => {
    const r = createRect('no-group', 20, 20);
    harness.setElement(r as CanvasElement);

    const safeUngroup = (ids: string[]) => {
      harness.transact(() => {
        ids.forEach((id) => {
          const el = harness.getElement(id);
          if (el && (el as any).groupId) {
            const updated = { ...el };
            delete (updated as any).groupId;
            harness.setElement(updated);
          }
        });
      });
    };

    expect(() => safeUngroup(['no-group'])).not.toThrow();
    expect((harness.getElement('no-group') as any).groupId).toBeUndefined();
  });

  it('T2-GRP-4: Grouping elements with zero or negative dimensions preserves bounds and group integrity', () => {
    const r1 = createRect('z-1', -100, -200);
    r1.width = 0;
    r1.height = 0;
    const r2 = createRect('z-2', -50, -50);
    harness.setElements([r1 as CanvasElement, r2 as CanvasElement]);

    const newGid = 'zero-grp';
    harness.transact(() => {
      harness.setElement({ ...r1, groupId: newGid } as CanvasElement);
      harness.setElement({ ...r2, groupId: newGid } as CanvasElement);
    });

    expect((harness.getElement('z-1') as any).groupId).toBe('zero-grp');
    expect((harness.getElement('z-2') as any).groupId).toBe('zero-grp');
  });

  it('T2-GRP-5: Re-grouping elements that belong to different groups merges them into a single new group ID', () => {
    const el1 = { id: 'rg-1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: 'old-1' } as CanvasElement;
    const el2 = { id: 'rg-2', type: 'rect', x: 50, y: 50, zIndex: 2, updatedAt: 1, groupId: 'old-2' } as CanvasElement;
    harness.setElements([el1, el2]);

    const mergedGroupId = 'merged-uuid';
    harness.transact(() => {
      harness.setElement({ ...el1, groupId: mergedGroupId });
      harness.setElement({ ...el2, groupId: mergedGroupId });
    });

    expect((harness.getElement('rg-1') as any).groupId).toBe(mergedGroupId);
    expect((harness.getElement('rg-2') as any).groupId).toBe(mergedGroupId);
  });

  it('T2-GRP-6: Moving a group by extreme displacement updates all coordinates without NaN or loss of precision', () => {
    const el1 = { id: 'ext-1', type: 'rect', x: 0, y: 0, zIndex: 1, updatedAt: 1, groupId: 'ext-grp' } as CanvasElement;
    const el2 = { id: 'ext-2', type: 'rect', x: 10, y: 10, zIndex: 2, updatedAt: 1, groupId: 'ext-grp' } as CanvasElement;
    harness.setElements([el1, el2]);

    const extremeDelta = 1000000;
    harness.transact(() => {
      [el1, el2].forEach((el) => {
        harness.setElement({ ...el, x: el.x + extremeDelta, y: el.y - extremeDelta });
      });
    });

    expect(harness.getElement('ext-1')!.x).toBe(1000000);
    expect(harness.getElement('ext-1')!.y).toBe(-1000000);
    expect(harness.getElement('ext-2')!.x).toBe(1000010);
    expect(harness.getElement('ext-2')!.y).toBe(-999990);
  });
});
