import { describe, it, expect } from 'vitest';
import {
  computeBoardBounds,
  computeMinimapViewportBox,
  minimapPointToCanvasViewport,
} from '../helpers/testOracles';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 1: Feature 6 - Interactive Minimap', () => {
  const createRect = (id: string, x: number, y: number, w: number, h: number): RectElement => ({
    id,
    type: 'rect',
    x,
    y,
    width: w,
    height: h,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    zIndex: 1,
    updatedAt: Date.now(),
  });

  it('T1-MINI-1: computeBoardBounds should calculate bounding box enclosing all canvas elements', () => {
    const r1 = createRect('r1', 100, 100, 100, 100); // 100..200, 100..200
    const r2 = createRect('r2', 400, 500, 200, 100); // 400..600, 500..600

    const bounds = computeBoardBounds([r1 as CanvasElement, r2 as CanvasElement]);

    expect(bounds.minX).toBe(100);
    expect(bounds.minY).toBe(100);
    expect(bounds.maxX).toBe(600);
    expect(bounds.maxY).toBe(600);
    expect(bounds.width).toBe(500);
    expect(bounds.height).toBe(500);
  });

  it('T1-MINI-2: computeMinimapViewportBox should scale visible viewport into minimap thumbnail coords', () => {
    // board: width 1000, height 1000, minX=0, minY=0
    const boardBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };
    // minimap size: 200 x 200 -> scale = 200 / 1000 = 0.2
    const minimapSize = { width: 200, height: 200 };
    // viewport: at x=0, y=0, scale=1, screen size 500x500
    const viewport = { x: 0, y: 0, width: 500, height: 500, scale: 1 };

    const box = computeMinimapViewportBox(viewport, boardBounds, minimapSize);

    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.width).toBe(100);  // 500 * 0.2
    expect(box.height).toBe(100); // 500 * 0.2
  });

  it('T1-MINI-3: minimap viewport box should shift when main canvas viewport is panned', () => {
    const boardBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };
    const minimapSize = { width: 200, height: 200 }; // scale = 0.2
    // Canvas panned by 200px (viewport x = -200 means visible left is 200)
    const viewport = { x: -200, y: -100, width: 500, height: 500, scale: 1 };

    const box = computeMinimapViewportBox(viewport, boardBounds, minimapSize);

    expect(box.x).toBe(40); // 200 * 0.2 = 40
    expect(box.y).toBe(20); // 100 * 0.2 = 20
  });

  it('T1-MINI-4: clicking on minimap should compute new canvas viewport centering clicked location', () => {
    const boardBounds = { minX: 0, minY: 0, width: 1000, height: 1000 };
    const minimapSize = { width: 200, height: 200 }; // scale = 0.2
    const viewport = { width: 600, height: 400, scale: 1 };

    // Clicking at center of minimap (100, 100) -> corresponds to board target (500, 500)
    // To center board (500, 500) on 600x400 screen: vx = -(500 - 300) = -200, vy = -(500 - 200) = -300
    const newVp = minimapPointToCanvasViewport({ x: 100, y: 100 }, minimapSize, boardBounds, viewport);

    expect(newVp.x).toBe(-200);
    expect(newVp.y).toBe(-300);
  });

  it('T1-MINI-5: minimap viewport box scales proportionally with canvas zoom level', () => {
    const boardBounds = { minX: 0, minY: 0, width: 1000, height: 1000 };
    const minimapSize = { width: 200, height: 200 };
    // At zoom scale = 2, visible canvas area is halved (500/2 = 250)
    const viewport = { x: 0, y: 0, width: 500, height: 500, scale: 2 };

    const box = computeMinimapViewportBox(viewport, boardBounds, minimapSize);

    expect(box.width).toBe(50);  // 250 * 0.2 = 50
    expect(box.height).toBe(50);
  });

  it('T1-MINI-6: empty canvas should produce a valid fallback bounding box without NaN/errors', () => {
    const bounds = computeBoardBounds([]);

    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(Number.isNaN(bounds.minX)).toBe(false);
  });
});
