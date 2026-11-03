import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YjsTestHarness } from '../helpers/yjsTestHarness';
import { generateStarterTemplate } from '../helpers/testOracles';
import { CanvasElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 7 - Board Starter Templates Library', () => {
  let harness: YjsTestHarness;

  beforeEach(() => {
    harness = new YjsTestHarness(107);
  });

  afterEach(() => {
    harness.cleanup();
  });

  it('T1-TPL-1: Sprint Retrospective template should generate 3 color-coded columns', () => {
    const elements = generateStarterTemplate('retro', { x: 500, y: 500 });

    expect(elements.length).toBeGreaterThanOrEqual(6);
    const headers = elements.filter((e) => (e as any).text && ['What went well', 'What could improve', 'Action items'].includes((e as any).text));
    expect(headers.length).toBe(3);

    // Verify distinct colors: green, pink, blue
    const colors = headers.map((h) => (h as any).color);
    expect(colors).toContain('green');
    expect(colors).toContain('pink');
    expect(colors).toContain('blue');
  });

  it('T1-TPL-2: Kanban Board template should generate 3 frame columns: To Do, In Progress, Done', () => {
    const elements = generateStarterTemplate('kanban', { x: 600, y: 400 });

    const frames = elements.filter((e) => e.type === 'frame');
    expect(frames.length).toBe(3);

    const titles = frames.map((f) => (f as any).title);
    expect(titles).toContain('To Do');
    expect(titles).toContain('In Progress');
    expect(titles).toContain('Done');
  });

  it('T1-TPL-3: Flowchart Starter template should generate process rects and connecting arrows', () => {
    const elements = generateStarterTemplate('flowchart', { x: 400, y: 300 });

    const rects = elements.filter((e) => e.type === 'rect');
    const arrows = elements.filter((e) => e.type === 'arrow');

    expect(rects.length).toBeGreaterThanOrEqual(3); // 2 process boxes + 1 diamond
    expect(arrows.length).toBeGreaterThanOrEqual(2);
  });

  it('T1-TPL-4: SWOT Analysis Matrix template should generate 2x2 grid with 4 labeled quadrants', () => {
    const elements = generateStarterTemplate('swot', { x: 500, y: 500 });

    expect(elements.length).toBe(4);
    const titles = elements.map((e) => (e as any).title);
    expect(titles).toContain('Strengths');
    expect(titles).toContain('Weaknesses');
    expect(titles).toContain('Opportunities');
    expect(titles).toContain('Threats');
  });

  it('T1-TPL-5: Template elements should be positioned relative to the provided center position', () => {
    const centerA = { x: 100, y: 200 };
    const centerB = { x: 1000, y: 2000 };

    const tplA = generateStarterTemplate('retro', centerA);
    const tplB = generateStarterTemplate('retro', centerB);

    // Coordinate offset should equal center delta
    const deltaX = centerB.x - centerA.x;
    const deltaY = centerB.y - centerA.y;

    expect(tplB[0].x - tplA[0].x).toBe(deltaX);
    expect(tplB[0].y - tplA[0].y).toBe(deltaY);
  });

  it('T1-TPL-6: Template insertion should be committed atomically to Yjs', () => {
    const tpl = generateStarterTemplate('kanban', { x: 0, y: 0 });

    harness.setElements(tpl, 'local');

    expect(harness.getElements().length).toBe(tpl.length);
    expect(harness.canUndo()).toBe(true);

    // Single undo reverts the entire template
    harness.undo();
    expect(harness.getElements().length).toBe(0);
  });
});
