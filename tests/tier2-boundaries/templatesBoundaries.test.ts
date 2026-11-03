import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { generateStarterTemplate } from '../helpers/testOracles';
import { CanvasElement } from '../../src/types/whiteboard';

describe('Tier 2: Boundary & Corner Cases - Starter Templates', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(207);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('T2-TPL-1: Generating template at extreme negative coordinates maintains clean relative positioning', () => {
    const center = { x: -10000, y: -10000 };
    const elements = generateStarterTemplate('retro', center);

    elements.forEach((el) => {
      expect(el.x).toBeLessThan(0);
      expect(el.y).toBeLessThan(0);
      expect(Number.isFinite(el.x)).toBe(true);
      expect(Number.isFinite(el.y)).toBe(true);
    });
  });

  it('T2-TPL-2: Instantiating the same template multiple times produces strictly unique IDs for all elements', () => {
    const tpl1 = generateStarterTemplate('flowchart', { x: 0, y: 0 });
    // Small timeout / tick to ensure distinct timestamps
    const tpl2 = generateStarterTemplate('flowchart', { x: 500, y: 500 });

    const allIds = [...tpl1.map((e) => e.id), ...tpl2.map((e) => e.id)];
    const uniqueIds = new Set(allIds);

    // Verify all IDs are completely unique
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('T2-TPL-3: Template generation with non-standard viewport center (fractional coordinates) handles cleanly', () => {
    const center = { x: 333.333, y: 777.777 };
    const elements = generateStarterTemplate('kanban', center);

    expect(elements.length).toBeGreaterThan(0);
    elements.forEach((el) => {
      expect(Number.isNaN(el.x)).toBe(false);
      expect(Number.isNaN(el.y)).toBe(false);
    });
  });

  it('T2-TPL-4: Appending a template onto an already populated board preserves existing elements', () => {
    const existing: CanvasElement = {
      id: 'pre-existing',
      type: 'rect',
      x: 50,
      y: 50,
      zIndex: 1,
      updatedAt: 1,
    } as any;
    harness.setElement(existing);

    const tpl = generateStarterTemplate('swot', { x: 400, y: 400 });
    harness.setElements(tpl);

    expect(harness.getElement('pre-existing')).toBeDefined();
    expect(harness.getElements().length).toBe(1 + tpl.length);
  });

  it('T2-TPL-5: Generated template elements pass validation for all required BaseElement fields', () => {
    const templates = ['retro', 'kanban', 'flowchart', 'swot'] as const;

    for (const t of templates) {
      const els = generateStarterTemplate(t, { x: 0, y: 0 });
      els.forEach((el) => {
        expect(typeof el.id).toBe('string');
        expect(typeof el.type).toBe('string');
        expect(typeof el.x).toBe('number');
        expect(typeof el.y).toBe('number');
        expect(typeof el.zIndex).toBe('number');
        expect(typeof el.updatedAt).toBe('number');
      });
    }
  });

  it('T2-TPL-6: Undoing template insertion on an existing board removes ONLY the template elements', () => {
    const prior = { id: 'prior-element', type: 'rect', x: 10, y: 10, zIndex: 1, updatedAt: 1 } as CanvasElement;
    harness.setElement(prior, 'remote');
    harness.undoManager.stopCapturing();

    // Insert template locally
    const tpl = generateStarterTemplate('retro', { x: 100, y: 100 });
    harness.setElements(tpl, 'local');
    expect(harness.getElements().length).toBe(1 + tpl.length);

    // Undo should restore only prior element
    harness.undo();
    expect(harness.getElements().length).toBe(1);
    expect(harness.getElement('prior-element')).toBeDefined();
  });
});
