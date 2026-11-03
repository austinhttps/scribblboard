import { describe, it, expect } from 'vitest';
import {
  computeBoardBounds,
  computeMinimapViewportBox,
  minimapPointToCanvasViewport,
} from '../helpers/testOracles';
import { CanvasElement, RectElement } from '../../src/types/whiteboard';

describe('Tier 2: Boundary & Corner Cases - Interactive Minimap', () => {
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

  it('T2-MINI-1: Minimap at extreme zoom out (scale 0.05) computes finite viewport box dimensions', () => {
    const boardBounds = { minX: 0, minY: 0, width: 1000, height: 1000 };
    const minimapSize = { width: 200, height: 200 };
    const viewport = { x: 0, y: 0, width: 800, height: 600, scale: 0.05 };

    const box = computeMinimapViewportBox(viewport, boardBounds, minimapSize);

    expect(Number.isFinite(box.width)).toBe(true);
    expect(Number.isFinite(box.height)).toBe(true);
    expect(box.width).toBeGreaterThan(0);
  });

  it('T2-MINI-2: Minimap at extreme zoom in (scale 10.0) renders micro viewport box without NaN', () => {
    const boardBounds = { minX: 0, minY: 0, width: 1000, height: 1000 };
    const minimapSize = { width: 200, height: 200 };
    const viewport = { x: -5000, y: -5000, width: 800, height: 600, scale: 10.0 };

    const box = computeMinimapViewportBox(viewport, boardBounds, minimapSize);

    expect(Number.isNaN(box.x)).toBe(false);
    expect(Number.isNaN(box.y)).toBe(false);
    expect(box.width).toBeLessThan(50);
  });

  it('T2-MINI-3: Minimap with elements at extreme coordinates (-50000 to +50000) computes valid scale', () => {
    const r1 = createRect('far-left', -50000, -50000, 100, 100);
    const r2 = createRect('far-right', 50000, 50000, 100, 100);

    const bounds = computeBoardBounds([r1 as CanvasElement, r2 as CanvasElement]);

    expect(bounds.minX).toBe(-50000);
    expect(bounds.maxX).toBe(50100);
    expect(bounds.width).toBe(100100);

    const box = computeMinimapViewportBox(
      { x: 0, y: 0, width: 1000, height: 1000, scale: 1 },
      bounds,
      { width: 200, height: 200 }
    );
    expect(Number.isFinite(box.width)).toBe(true);
  });

  it('T2-MINI-4: Clicking origin (0, 0) on minimap centers viewport at board minX and minY', () => {
    const boardBounds = { minX: 100, minY: 200, width: 1000, height: 1000 };
    const minimapSize = { width: 200, height: 200 };
    const viewport = { width: 500, height: 500, scale: 1 };

    const newVp = minimapPointToCanvasViewport({ x: 0, y: 0 }, minimapSize, boardBounds, viewport);

    // Target is minX=100, minY=200 -> vx = -(100 - 250) = 150, vy = -(200 - 250) = 50
    expect(newVp.x).toBe(150);
    expect(newVp.y).toBe(50);
  });

  it('T2-MINI-5: Minimap with single zero-dimension element computes minimum positive bounds', () => {
    const r = createRect('zero-el', 10, 10, 0, 0);
    const bounds = computeBoardBounds([r as CanvasElement]);

    expect(bounds.width).toBeGreaterThanOrEqual(100);
    expect(bounds.height).toBeGreaterThanOrEqual(100);
  });

  it('T2-MINI-6: Minimap click with fractional coordinates computes precision without NaN', () => {
    const boardBounds = { minX: 0, minY: 0, width: 1000, height: 1000 };
    const minimapSize = { width: 200, height: 200 };
    const viewport = { width: 600, height: 400, scale: 1.333 };

    const newVp = minimapPointToCanvasViewport({ x: 42.75, y: 88.33 }, minimapSize, boardBounds, viewport);

    expect(Number.isFinite(newVp.x)).toBe(true);
    expect(Number.isFinite(newVp.y)).toBe(true);
    expect(Number.isNaN(newVp.x)).toBe(false);
  });
});
