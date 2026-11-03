import { CanvasElement } from '../../src/types/whiteboard';

export interface FrameElement extends CanvasElement {
  type: 'frame';
  title: string;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributionType = 'horizontal' | 'vertical';

export interface ElementBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface SnapResult {
  snappedX?: number;
  snappedY?: number;
  guides: Array<{ points: number[] }>;
}

/**
 * 1. Element Bounds Computation
 */
export function computeElementBounds(el: CanvasElement): ElementBounds {
  let minX = el.x;
  let minY = el.y;
  let maxX = el.x + 50;
  let maxY = el.y + 50;

  if (el.type === 'rect' || el.type === 'sticky' || el.type === 'image' || el.type === 'frame') {
    const w = (el as any).width ?? 120;
    const h = (el as any).height ?? 80;
    maxX = el.x + w;
    maxY = el.y + h;
  } else if (el.type === 'circle') {
    const rx = (el as any).radiusX ?? 30;
    const ry = (el as any).radiusY ?? 30;
    minX = el.x - rx;
    minY = el.y - ry;
    maxX = el.x + rx;
    maxY = el.y + ry;
  } else if (el.type === 'text') {
    const fs = (el as any).fontSize ?? 20;
    const len = Math.max(((el as any).text ?? '').length, 1);
    const w = (el as any).width ?? Math.max(len * fs * 0.6, 60);
    const h = fs * 1.4;
    maxX = el.x + w;
    maxY = el.y + h;
  } else if (el.type === 'pen' || el.type === 'arrow' || el.type === 'line') {
    const pts: number[] = (el as any).points ?? [];
    if (pts.length > 0) {
      let pMinX = Infinity;
      let pMinY = Infinity;
      let pMaxX = -Infinity;
      let pMaxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        const px = pts[i] + (el.x || 0);
        const py = pts[i + 1] + (el.y || 0);
        pMinX = Math.min(pMinX, px);
        pMinY = Math.min(pMinY, py);
        pMaxX = Math.max(pMaxX, px);
        pMaxY = Math.max(pMaxY, py);
      }
      minX = pMinX;
      minY = pMinY;
      maxX = pMaxX;
      maxY = pMaxY;
    }
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * 2. Alignment Utilities
 */
export function alignElements(elements: CanvasElement[], alignment: AlignmentType): CanvasElement[] {
  if (elements.length <= 1) return elements.map((e) => ({ ...e }));

  const boundsList = elements.map((el) => computeElementBounds(el));
  const overallMinX = Math.min(...boundsList.map((b) => b.minX));
  const overallMaxX = Math.max(...boundsList.map((b) => b.maxX));
  const overallMinY = Math.min(...boundsList.map((b) => b.minY));
  const overallMaxY = Math.max(...boundsList.map((b) => b.maxY));
  const overallCenterX = overallMinX + (overallMaxX - overallMinX) / 2;
  const overallCenterY = overallMinY + (overallMaxY - overallMinY) / 2;

  return elements.map((el, i) => {
    // If element is locked, it must not be aligned/repositioned
    if ((el as any).locked) {
      return { ...el };
    }
    const b = boundsList[i];
    const offsetX = el.x - b.minX;
    const offsetY = el.y - b.minY;

    let targetX = el.x;
    let targetY = el.y;

    switch (alignment) {
      case 'left':
        targetX = overallMinX + offsetX;
        break;
      case 'center':
        targetX = overallCenterX - b.width / 2 + offsetX;
        break;
      case 'right':
        targetX = overallMaxX - b.width + offsetX;
        break;
      case 'top':
        targetY = overallMinY + offsetY;
        break;
      case 'middle':
        targetY = overallCenterY - b.height / 2 + offsetY;
        break;
      case 'bottom':
        targetY = overallMaxY - b.height + offsetY;
        break;
    }

    return {
      ...el,
      x: targetX,
      y: targetY,
    };
  });
}

/**
 * 3. Distribution Utilities
 */
export function distributeElements(elements: CanvasElement[], direction: DistributionType): CanvasElement[] {
  if (elements.length <= 2) return elements.map((e) => ({ ...e }));

  const items = elements.map((el) => ({
    el: { ...el },
    bounds: computeElementBounds(el),
  }));

  if (direction === 'horizontal') {
    items.sort((a, b) => a.bounds.minX - b.bounds.minX);
    const first = items[0];
    const last = items[items.length - 1];

    const totalSpan = last.bounds.minX - first.bounds.maxX;
    const middleWidths = items.slice(1, -1).reduce((sum, item) => sum + item.bounds.width, 0);
    const availableGap = totalSpan - middleWidths;
    const gap = availableGap / (items.length - 1);

    let currentEdge = first.bounds.maxX;
    for (let i = 1; i < items.length - 1; i++) {
      const item = items[i];
      if (!(item.el as any).locked) {
        const offset = item.el.x - item.bounds.minX;
        item.el.x = currentEdge + gap + offset;
      }
      currentEdge = currentEdge + gap + item.bounds.width;
    }
  } else {
    items.sort((a, b) => a.bounds.minY - b.bounds.minY);
    const first = items[0];
    const last = items[items.length - 1];

    const totalSpan = last.bounds.minY - first.bounds.maxY;
    const middleHeights = items.slice(1, -1).reduce((sum, item) => sum + item.bounds.height, 0);
    const availableGap = totalSpan - middleHeights;
    const gap = availableGap / (items.length - 1);

    let currentEdge = first.bounds.maxY;
    for (let i = 1; i < items.length - 1; i++) {
      const item = items[i];
      if (!(item.el as any).locked) {
        const offset = item.el.y - item.bounds.minY;
        item.el.y = currentEdge + gap + offset;
      }
      currentEdge = currentEdge + gap + item.bounds.height;
    }
  }

  return items.map((item) => item.el);
}

/**
 * 4. Snapping & Dynamic Guides
 */
export function calculateSnapping(
  draggedBounds: ElementBounds,
  otherElements: CanvasElement[],
  threshold: number = 5
): SnapResult {
  let snappedX: number | undefined;
  let snappedY: number | undefined;
  const guides: Array<{ points: number[] }> = [];

  const otherBounds = otherElements.map((el) => computeElementBounds(el));

  const dragXTargets = [
    { type: 'left', val: draggedBounds.minX },
    { type: 'center', val: draggedBounds.centerX },
    { type: 'right', val: draggedBounds.maxX },
  ];

  const dragYTargets = [
    { type: 'top', val: draggedBounds.minY },
    { type: 'middle', val: draggedBounds.centerY },
    { type: 'bottom', val: draggedBounds.maxY },
  ];

  let minDeltaX = threshold + 1;
  let chosenSnapX: number | undefined;
  let chosenGuideX: number | undefined;

  for (const ob of otherBounds) {
    const obXTargets = [ob.minX, ob.centerX, ob.maxX];
    for (const dt of dragXTargets) {
      for (const ot of obXTargets) {
        const diff = Math.abs(dt.val - ot);
        if (diff <= threshold && diff < minDeltaX) {
          minDeltaX = diff;
          chosenGuideX = ot;
          if (dt.type === 'left') chosenSnapX = ot;
          else if (dt.type === 'center') chosenSnapX = ot - draggedBounds.width / 2;
          else if (dt.type === 'right') chosenSnapX = ot - draggedBounds.width;
        }
      }
    }
  }

  if (chosenSnapX !== undefined && chosenGuideX !== undefined) {
    snappedX = chosenSnapX;
    guides.push({ points: [chosenGuideX, -10000, chosenGuideX, 10000] });
  }

  let minDeltaY = threshold + 1;
  let chosenSnapY: number | undefined;
  let chosenGuideY: number | undefined;

  for (const ob of otherBounds) {
    const obYTargets = [ob.minY, ob.centerY, ob.maxY];
    for (const dt of dragYTargets) {
      for (const ot of obYTargets) {
        const diff = Math.abs(dt.val - ot);
        if (diff <= threshold && diff < minDeltaY) {
          minDeltaY = diff;
          chosenGuideY = ot;
          if (dt.type === 'top') chosenSnapY = ot;
          else if (dt.type === 'middle') chosenSnapY = ot - draggedBounds.height / 2;
          else if (dt.type === 'bottom') chosenSnapY = ot - draggedBounds.height;
        }
      }
    }
  }

  if (chosenSnapY !== undefined && chosenGuideY !== undefined) {
    snappedY = chosenSnapY;
    guides.push({ points: [-10000, chosenGuideY, 10000, chosenGuideY] });
  }

  return { snappedX, snappedY, guides };
}

/**
 * 5. Frame Utilities
 */
export function isElementInsideFrame(el: CanvasElement, frame: FrameElement): boolean {
  if (el.id === frame.id) return false;
  const eb = computeElementBounds(el);
  const fb = computeElementBounds(frame);

  // An element is inside a frame if its center point or entire bounding box is within frame boundaries
  return (
    eb.centerX >= fb.minX &&
    eb.centerX <= fb.maxX &&
    eb.centerY >= fb.minY &&
    eb.centerY <= fb.maxY
  );
}

export function getElementsInFrame(frame: FrameElement, allElements: CanvasElement[]): CanvasElement[] {
  return allElements.filter((el) => isElementInsideFrame(el, frame));
}

export function moveFrameWithChildren(
  frame: FrameElement,
  allElements: CanvasElement[],
  dx: number,
  dy: number
): CanvasElement[] {
  const children = getElementsInFrame(frame, allElements);
  const childIds = new Set(children.map((c) => c.id));

  return allElements.map((el) => {
    if (el.id === frame.id) {
      return { ...el, x: el.x + dx, y: el.y + dy };
    }
    if (childIds.has(el.id)) {
      return { ...el, x: el.x + dx, y: el.y + dy };
    }
    return el;
  });
}

/**
 * 6. Minimap Utilities
 */
export function computeBoardBounds(elements: CanvasElement[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 };
  }
  const bounds = elements.map((e) => computeElementBounds(e));
  const minX = Math.min(...bounds.map((b) => b.minX));
  const minY = Math.min(...bounds.map((b) => b.minY));
  const maxX = Math.max(...bounds.map((b) => b.maxX));
  const maxY = Math.max(...bounds.map((b) => b.maxY));
  const width = Math.max(maxX - minX, 100);
  const height = Math.max(maxY - minY, 100);
  return { minX, minY, maxX, maxY, width, height };
}

export function computeMinimapViewportBox(
  viewport: { x: number; y: number; width: number; height: number; scale: number },
  boardBounds: { minX: number; minY: number; width: number; height: number },
  minimapSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const scaleX = minimapSize.width / Math.max(boardBounds.width, 1);
  const scaleY = minimapSize.height / Math.max(boardBounds.height, 1);
  const scale = Math.min(scaleX, scaleY);

  // Visible canvas bounds under current viewport
  const visibleLeft = -viewport.x / viewport.scale;
  const visibleTop = -viewport.y / viewport.scale;
  const visibleWidth = viewport.width / viewport.scale;
  const visibleHeight = viewport.height / viewport.scale;

  const boxX = (visibleLeft - boardBounds.minX) * scale;
  const boxY = (visibleTop - boardBounds.minY) * scale;
  const boxW = visibleWidth * scale;
  const boxH = visibleHeight * scale;

  return {
    x: Object.is(boxX, -0) ? 0 : boxX,
    y: Object.is(boxY, -0) ? 0 : boxY,
    width: boxW,
    height: boxH,
  };
}

export function minimapPointToCanvasViewport(
  clickPoint: { x: number; y: number },
  minimapSize: { width: number; height: number },
  boardBounds: { minX: number; minY: number; width: number; height: number },
  viewport: { width: number; height: number; scale: number }
): { x: number; y: number } {
  const scaleX = minimapSize.width / Math.max(boardBounds.width, 1);
  const scaleY = minimapSize.height / Math.max(boardBounds.height, 1);
  const scale = Math.min(scaleX, scaleY);

  const boardTargetX = boardBounds.minX + clickPoint.x / scale;
  const boardTargetY = boardBounds.minY + clickPoint.y / scale;

  // Center viewport at boardTarget
  const newVx = -(boardTargetX * viewport.scale - viewport.width / 2);
  const newVy = -(boardTargetY * viewport.scale - viewport.height / 2);

  return { x: newVx, y: newVy };
}

/**
 * 7. Starter Templates Generator
 */
export function generateStarterTemplate(
  templateType: 'retro' | 'kanban' | 'flowchart' | 'swot',
  centerPos: { x: number; y: number }
): CanvasElement[] {
  const now = Date.now();
  const uid = () => crypto.randomUUID().slice(0, 8);
  switch (templateType) {
    case 'retro': {
      // 3 columns: What went well, What could improve, Action items
      const cols = [
        { title: 'What went well', color: 'green' as const, dx: -240 },
        { title: 'What could improve', color: 'pink' as const, dx: 0 },
        { title: 'Action items', color: 'blue' as const, dx: 240 },
      ];
      return cols.flatMap((c, idx) => [
        {
          id: `retro-header-${idx}-${uid()}`,
          type: 'sticky',
          x: centerPos.x + c.dx,
          y: centerPos.y - 120,
          width: 200,
          height: 80,
          text: c.title,
          color: c.color,
          fontSize: 16,
          zIndex: 1,
          updatedAt: now,
        } as CanvasElement,
        {
          id: `retro-note-${idx}-${uid()}`,
          type: 'sticky',
          x: centerPos.x + c.dx,
          y: centerPos.y,
          width: 200,
          height: 140,
          text: `Sample item for ${c.title}`,
          color: c.color,
          fontSize: 14,
          zIndex: 2,
          updatedAt: now,
        } as CanvasElement,
      ]);
    }
    case 'kanban': {
      // 3 frame columns: To Do, In Progress, Done
      const cols = [
        { title: 'To Do', dx: -350 },
        { title: 'In Progress', dx: 0 },
        { title: 'Done', dx: 350 },
      ];
      return cols.flatMap((c, idx) => [
        {
          id: `kanban-frame-${idx}-${uid()}`,
          type: 'frame',
          title: c.title,
          x: centerPos.x + c.dx,
          y: centerPos.y - 150,
          width: 300,
          height: 500,
          fill: '#f8fafc',
          stroke: '#cbd5e1',
          strokeWidth: 2,
          zIndex: 1,
          updatedAt: now,
        } as unknown as CanvasElement,
        {
          id: `kanban-card-${idx}-${uid()}`,
          type: 'sticky',
          x: centerPos.x + c.dx + 30,
          y: centerPos.y - 80,
          width: 240,
          height: 100,
          text: `Task in ${c.title}`,
          color: 'yellow',
          fontSize: 14,
          zIndex: 2,
          updatedAt: now,
        } as CanvasElement,
      ]);
    }
    case 'flowchart': {
      // Process 1 -> Decision -> Process 2
      const p1: CanvasElement = {
        id: `flow-p1-${uid()}`,
        type: 'rect',
        x: centerPos.x - 250,
        y: centerPos.y - 40,
        width: 140,
        height: 80,
        fill: '#e0e7ff',
        stroke: '#4f46e5',
        strokeWidth: 2,
        zIndex: 1,
        updatedAt: now,
      };
      const dec: CanvasElement = {
        id: `flow-dec-${uid()}`,
        type: 'rect',
        x: centerPos.x,
        y: centerPos.y - 40,
        width: 140,
        height: 80,
        fill: '#fef3c7',
        stroke: '#d97706',
        strokeWidth: 2,
        rotation: 45,
        zIndex: 2,
        updatedAt: now,
      };
      const p2: CanvasElement = {
        id: `flow-p2-${uid()}`,
        type: 'rect',
        x: centerPos.x + 250,
        y: centerPos.y - 40,
        width: 140,
        height: 80,
        fill: '#d1fae5',
        stroke: '#059669',
        strokeWidth: 2,
        zIndex: 3,
        updatedAt: now,
      };
      const arrow1: CanvasElement = {
        id: `flow-arr1-${uid()}`,
        type: 'arrow',
        x: centerPos.x - 110,
        y: centerPos.y,
        points: [0, 0, 110, 0],
        color: '#475569',
        strokeWidth: 2,
        zIndex: 4,
        updatedAt: now,
      };
      const arrow2: CanvasElement = {
        id: `flow-arr2-${uid()}`,
        type: 'arrow',
        x: centerPos.x + 140,
        y: centerPos.y,
        points: [0, 0, 110, 0],
        color: '#475569',
        strokeWidth: 2,
        zIndex: 5,
        updatedAt: now,
      };
      return [p1, dec, p2, arrow1, arrow2];
    }
    case 'swot': {
      // 2x2 grid: Strengths, Weaknesses, Opportunities, Threats
      const quadrants = [
        { title: 'Strengths', dx: -220, dy: -220, fill: '#dcfce7' },
        { title: 'Weaknesses', dx: 20, dy: -220, fill: '#fee2e2' },
        { title: 'Opportunities', dx: -220, dy: 20, fill: '#e0f2fe' },
        { title: 'Threats', dx: 20, dy: 20, fill: '#fef3c7' },
      ];
      return quadrants.map((q, idx) => ({
        id: `swot-quad-${idx}-${uid()}`,
        type: 'frame',
        title: q.title,
        x: centerPos.x + q.dx,
        y: centerPos.y + q.dy,
        width: 200,
        height: 200,
        fill: q.fill,
        stroke: '#94a3b8',
        strokeWidth: 2,
        zIndex: idx + 1,
        updatedAt: now,
      } as unknown as CanvasElement));
    }
  }
}

/**
 * 8. Laser Pointer & Follow Mode
 */
export interface LaserPoint {
  x: number;
  y: number;
  color: string;
  timestamp: number;
}

export function pruneLaserPoints(points: LaserPoint[], maxAgeMs: number = 1500, now: number = Date.now()): LaserPoint[] {
  return points.filter((p) => now - p.timestamp <= maxAgeMs);
}

export function computeFollowTarget(
  remoteViewport: { x: number; y: number; scale: number }
): { x: number; y: number; scale: number } {
  return {
    x: remoteViewport.x,
    y: remoteViewport.y,
    scale: remoteViewport.scale,
  };
}
