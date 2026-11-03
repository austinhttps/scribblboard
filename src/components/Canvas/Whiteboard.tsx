import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Transformer, Rect as KonvaRect, Line as KonvaLine, Circle as KonvaCircle, Arrow as KonvaArrow } from 'react-konva';
import Konva from 'konva';
import { CanvasElement, ToolType, ToolProperties, GridType, StickyColor, Collaborator, ThemeMode, ConnectorPoint, CommentThread } from '../../types/whiteboard';
import { ElementRenderer } from './ElementRenderer';
import { GridBackground } from './GridBackground';
import { PeerCursors } from './PeerCursors';
import { ConnectorAnchors } from './ConnectorAnchors';
import { ObjectOverlayBadges } from './ObjectOverlayBadges';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { exportStageToPNG } from '../../utils/exportUtils';
import {
  getAllConnectorPoints,
  findNearestConnectorPoint,
  updateAttachedConnectors,
} from '../../utils/connectorUtils';
import {
  calculateSnapping,
  computeElementBounds,
  moveFrameWithChildren,
} from '../../utils/canvasTools';

interface WhiteboardProps {
  elements: CanvasElement[];
  comments: CommentThread[];
  localUser: { name: string; color: string; id: string };
  currentTool: ToolType;
  toolProperties: ToolProperties;
  gridType: GridType;
  theme: ThemeMode;
  onSetTool: (tool: ToolType) => void;
  onSetElement: (element: CanvasElement) => void;
  onSetBatchElements: (elements: CanvasElement[]) => void;
  onDeleteElement: (id: string) => void;
  onDeleteElements: (ids: string[]) => void;
  getNextZIndex: () => number;
  stageRef: React.RefObject<Konva.Stage | null>;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  onUploadImagePrompt: () => void;
  clipboard: CanvasElement[];
  onCopyElements: () => void;
  onCutElements: () => void;
  onPasteElements: (point?: { x: number; y: number }) => void;
  collaborators: Collaborator[];
  onUpdateCursor: (pos: { x: number; y: number } | null) => void;
  onUpdateViewport?: (viewport: { x: number; y: number; scale: number }) => void;
  onUpdateLaserTrail?: (trail: { points: number[]; color: string; timestamp: number } | null) => void;
  snapToObjects?: boolean;
  followingClientId?: number | null;
  onBreakFollow?: () => void;
  onToggleReaction: (elementId: string, emoji: string) => void;
  onOpenEmojiPicker: (elementId: string, position: { x: number; y: number }) => void;
  onOpenComments: (elementId: string) => void;
}

interface InlineEditingState {
  id: string;
  type: 'sticky' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color?: StickyColor;
  fill?: string;
}

function getElementBounds(el: CanvasElement): { minX: number; minY: number; maxX: number; maxY: number } {
  if (el.type === 'rect' || el.type === 'sticky' || el.type === 'image') {
    const width = el.width || 120;
    const height = el.height || 80;
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + width,
      maxY: el.y + height,
    };
  }
  if (el.type === 'circle') {
    const rx = el.radiusX || 30;
    const ry = el.radiusY || 30;
    return {
      minX: el.x - rx,
      minY: el.y - ry,
      maxX: el.x + rx,
      maxY: el.y + ry,
    };
  }
  if (el.type === 'text') {
    const fontSize = el.fontSize || 20;
    const textLen = Math.max((el.text || '').length, 1);
    const width = Math.max(textLen * fontSize * 0.6, 60);
    const height = fontSize * 1.4;
    return {
      minX: el.x,
      minY: el.y,
      maxX: el.x + width,
      maxY: el.y + height,
    };
  }
  if (el.type === 'pen' || el.type === 'arrow' || el.type === 'line') {
    const pts = el.points || [];
    if (pts.length === 0) return { minX: el.x, minY: el.y, maxX: el.x + 10, maxY: el.y + 10 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i] + (el.x || 0);
      const py = pts[i + 1] + (el.y || 0);
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    return { minX, minY, maxX, maxY };
  }
  return { minX: (el as any).x || 0, minY: (el as any).y || 0, maxX: ((el as any).x || 0) + 50, maxY: ((el as any).y || 0) + 50 };
}

export const Whiteboard: React.FC<WhiteboardProps> = ({
  elements,
  comments,
  localUser,
  currentTool,
  toolProperties,
  gridType,
  theme,
  onSetTool,
  onSetElement,
  onSetBatchElements,
  onDeleteElement,
  onDeleteElements,
  getNextZIndex,
  stageRef,
  selectedIds,
  setSelectedIds,
  onUploadImagePrompt,
  clipboard,
  onCopyElements,
  onCutElements,
  onPasteElements,
  collaborators,
  onUpdateCursor,
  onUpdateViewport,
  onUpdateLaserTrail,
  snapToObjects = true,
  followingClientId,
  onBreakFollow,
  onToggleReaction,
  onOpenEmojiPicker,
  onOpenComments,
}) => {
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState<number>(1);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Drawing state
  const isDrawing = useRef<boolean>(false);
  const [newShape, setNewShape] = useState<CanvasElement | null>(null);

  // Active connector snap target
  const [activeSnapAnchor, setActiveSnapAnchor] = useState<ConnectorPoint | null>(null);

  // Selection box state
  const [selectionBox, setSelectionBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Dynamic alignment guides for smart snapping (Layer 3)
  const [alignmentGuides, setAlignmentGuides] = useState<Array<{ points: number[] }>>([]);

  // Local laser pointer trail state
  const [localLaserTrail, setLocalLaserTrail] = useState<number[]>([]);
  const laserFadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync stagePos / stageScale with remote leader when following
  useEffect(() => {
    if (!followingClientId) return;
    const leader = collaborators.find((c) => c.clientId === followingClientId);
    if (leader?.viewport) {
      setStagePos({ x: leader.viewport.x, y: leader.viewport.y });
      setStageScale(leader.viewport.scale);
    }
  }, [followingClientId, collaborators]);

  // Broadcast viewport updates
  useEffect(() => {
    onUpdateViewport?.({ x: stagePos.x, y: stagePos.y, scale: stageScale });
  }, [stagePos, stageScale, onUpdateViewport]);
  const dragStartPositionsRef = useRef<
    Map<
      string,
      {
        id: string;
        type: string;
        x: number;
        y: number;
        points?: number[];
        nodeInitialPos: { x: number; y: number };
      }
    >
  >(new Map());

  // Awareness cursor broadcast timestamp ref (throttle to 30ms)
  const lastCursorBroadcastRef = useRef<number>(0);

  // Inline editing overlay
  const [editingItem, setEditingItem] = useState<InlineEditingState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    canvasPoint: { x: number; y: number };
    targetElement: CanvasElement | null;
  } | null>(null);

  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);

  // Calculate connector anchors
  const allConnectorAnchors = useMemo(() => {
    return getAllConnectorPoints(elements);
  }, [elements]);

  const showConnectorAnchors =
    currentTool === 'arrow' || currentTool === 'line' || isDrawing.current;

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update Transformer attached nodes
  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;

    if (selectedIds.length === 0 || currentTool !== 'select') {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }

    const nodes = selectedIds
      .map((id) => layerRef.current?.findOne(`#${id}`))
      .filter((node): node is Konva.Node => !!node);

    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, elements, currentTool]);

  // Check if any selected element is locked
  const isSelectionLocked = useMemo(() => {
    return selectedIds.some((id) => {
      const el = elements.find((e) => e.id === id);
      return el?.locked === true;
    });
  }, [selectedIds, elements]);


  // Focus and select textarea only once when starting to edit a new item
  const prevEditingId = useRef<string | null>(null);
  useEffect(() => {
    if (editingItem && editingItem.id !== prevEditingId.current && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      prevEditingId.current = editingItem.id;
    } else if (!editingItem) {
      prevEditingId.current = null;
    }
  }, [editingItem?.id]);

  // Helper: Convert screen/viewport pointer to stage canvas coordinate
  const getCanvasPoint = useCallback((stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
  }, []);

  // Zoom with mouse wheel centered at pointer
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.08;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // Normalize wheel direction
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.1, Math.min(5, newScale));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStageScale(newScale);
    setStagePos(newPos);
  };

  // Right-Click Context Menu Trigger
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement> | Konva.KonvaEventObject<PointerEvent>) => {
    if ('evt' in e) {
      e.evt.preventDefault();
    } else {
      e.preventDefault();
    }

    const stage = stageRef.current;
    if (!stage) return;

    const point = getCanvasPoint(stage);

    let clientX = 0;
    let clientY = 0;

    if ('evt' in e) {
      clientX = (e.evt as MouseEvent).clientX;
      clientY = (e.evt as MouseEvent).clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Check if right-clicked on an existing canvas node
    let targetEl: CanvasElement | null = null;
    const targetNode = 'target' in e ? (e.target as any) : null;
    if (targetNode && typeof targetNode.id === 'function' && targetNode !== stage && targetNode.name?.() !== 'background-rect') {
      const id = targetNode.id();
      if (id) {
        targetEl = elements.find((el) => el.id === id) || null;
        if (targetEl && !selectedIds.includes(targetEl.id)) {
          const targetGroupId = targetEl.groupId;
          const groupMemberIds = targetGroupId
            ? elements.filter((el) => el.groupId === targetGroupId).map((el) => el.id)
            : [targetEl.id];
          setSelectedIds(groupMemberIds);
        }
      }
    }

    // If already has selection and right-clicked on empty space, keep selection target
    if (!targetEl && selectedIds.length > 0) {
      targetEl = elements.find((el) => el.id === selectedIds[0]) || null;
    }

    setContextMenu({
      x: clientX,
      y: clientY,
      canvasPoint: point,
      targetElement: targetEl,
    });
  };

  // Mouse Down / Touch Start
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // If right click, let context menu handle it
    if ((e.evt as MouseEvent).button === 2) {
      return;
    }

    // Close open context menu on left click
    if (contextMenu) {
      setContextMenu(null);
    }

    const stage = stageRef.current;
    if (!stage) return;

    // Check if clicked inside inline textarea or if we need to commit
    if (editingItem) {
      commitInlineEdit();
    }

    // Spacebar Pan or Hand Tool Pan
    if (isSpacePressed || currentTool === 'pan' || (e.evt as MouseEvent).button === 1) {
      if (followingClientId && onBreakFollow) {
        onBreakFollow();
      }
      setIsPanning(true);
      const pointer = stage.getPointerPosition();
      if (pointer) {
        setPanStart({ x: pointer.x - stage.x(), y: pointer.y - stage.y() });
      }
      return;
    }

    const point = getCanvasPoint(stage);
    const clickedOnEmpty = e.target === stage || e.target.name() === 'background-rect';

    if (currentTool === 'select') {
      if (clickedOnEmpty) {
        // Deselect or start selection box
        setSelectedIds([]);
        setSelectionBox({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
      }
      return;
    }

    if (currentTool === 'eraser') {
      if (!clickedOnEmpty && e.target.id()) {
        const el = elements.find((item) => item.id === e.target.id());
        if (el && !el.locked) {
          onDeleteElement(el.id);
        }
      }
      return;
    }

    // Instant placement tools
    if (currentTool === 'sticky') {
      const newSticky: CanvasElement = {
        id: crypto.randomUUID(),
        type: 'sticky',
        x: point.x - 85,
        y: point.y - 85,
        width: 170,
        height: 170,
        text: 'New Note',
        color: toolProperties.stickyColor,
        fontSize: 18,
        zIndex: getNextZIndex(),
        updatedAt: Date.now(),
      };
      onSetElement(newSticky);
      setSelectedIds([newSticky.id]);
      onSetTool('select');
      return;
    }

    if (currentTool === 'text') {
      const newText: CanvasElement = {
        id: crypto.randomUUID(),
        type: 'text',
        x: point.x,
        y: point.y,
        text: 'Type text here...',
        fontSize: toolProperties.fontSize || 22,
        fontFamily: 'Inter, sans-serif',
        fill: toolProperties.strokeColor,
        zIndex: getNextZIndex(),
        updatedAt: Date.now(),
      };
      onSetElement(newText);
      setSelectedIds([newText.id]);
      onSetTool('select');
      return;
    }

    // Drag-to-create shape tools
    isDrawing.current = true;
    const nextZ = getNextZIndex();

    // Check if starting arrow/line on a connector anchor
    const snapStart = findNearestConnectorPoint(point, elements);
    const startX = snapStart ? snapStart.x : point.x;
    const startY = snapStart ? snapStart.y : point.y;

    if (currentTool === 'pen') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'pen',
        points: [point.x, point.y],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'rect') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'rect',
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        cornerRadius: 4,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'circle') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'circle',
        x: point.x,
        y: point.y,
        radiusX: 1,
        radiusY: 1,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'frame') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'frame',
        title: 'Artboard',
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        fill: '#f8fafc',
        stroke: '#cbd5e1',
        strokeWidth: 2,
        zIndex: nextZ,
        updatedAt: Date.now(),
      } as any);
    } else if (currentTool === 'arrow') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'arrow',
        points: [startX, startY, startX, startY],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        startBinding: snapStart ? { elementId: snapStart.elementId, anchor: snapStart.anchor } : undefined,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    } else if (currentTool === 'line') {
      setNewShape({
        id: crypto.randomUUID(),
        type: 'line',
        points: [startX, startY, startX, startY],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        startBinding: snapStart ? { elementId: snapStart.elementId, anchor: snapStart.anchor } : undefined,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      });
    }
  };

  // Mouse Move / Touch Move
  const handleMouseMove = (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const point = getCanvasPoint(stage);

    // Broadcast cursor position to collaborators (throttled to 30ms)
    const now = performance.now();
    if (now - lastCursorBroadcastRef.current >= 30) {
      lastCursorBroadcastRef.current = now;
      onUpdateCursor(point);
    }

    if (isPanning) {
      const pointer = stage.getPointerPosition();
      if (pointer) {
        setStagePos({
          x: pointer.x - panStart.x,
          y: pointer.y - panStart.y,
        });
      }
      return;
    }

    // Laser pointer tool
    if (isDrawing.current && currentTool === 'laser') {
      const newPts = [...localLaserTrail, point.x, point.y];
      setLocalLaserTrail(newPts);
      onUpdateLaserTrail?.({
        points: newPts,
        color: '#ef4444',
        timestamp: Date.now(),
      });
      return;
    }

    // Check connector snap when drawing arrow/line
    if (isDrawing.current && newShape && (newShape.type === 'arrow' || newShape.type === 'line')) {
      const snap = findNearestConnectorPoint(point, elements);
      setActiveSnapAnchor(snap);

      const targetX = snap ? snap.x : point.x;
      const targetY = snap ? snap.y : point.y;

      setNewShape({
        ...newShape,
        points: [newShape.points[0], newShape.points[1], targetX, targetY],
        endBinding: snap ? { elementId: snap.elementId, anchor: snap.anchor } : undefined,
      });
      return;
    }

    // Selection box dragging
    if (selectionBox) {
      setSelectionBox((prev) => (prev ? { ...prev, x2: point.x, y2: point.y } : null));
      return;
    }

    if (!isDrawing.current || !newShape) return;

    if (newShape.type === 'pen') {
      setNewShape({
        ...newShape,
        points: [...newShape.points, point.x, point.y],
      });
    } else if (newShape.type === 'rect' || newShape.type === 'frame') {
      const width = point.x - newShape.x;
      const height = point.y - newShape.y;
      setNewShape({
        ...newShape,
        width,
        height,
      } as any);
    } else if (newShape.type === 'circle') {
      const rx = Math.abs(point.x - newShape.x);
      const ry = Math.abs(point.y - newShape.y);
      setNewShape({
        ...newShape,
        radiusX: Math.max(2, rx),
        radiusY: Math.max(2, ry),
      });
    }
  };

  // Mouse Up / Touch End
  const handleMouseUp = () => {
    setActiveSnapAnchor(null);

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Process selection box
    if (selectionBox) {
      const x1 = Math.min(selectionBox.x1, selectionBox.x2);
      const y1 = Math.min(selectionBox.y1, selectionBox.y2);
      const x2 = Math.max(selectionBox.x1, selectionBox.x2);
      const y2 = Math.max(selectionBox.y1, selectionBox.y2);

      // Only perform box selection if box was actually dragged
      if (Math.abs(x2 - x1) > 3 || Math.abs(y2 - y1) > 3) {
        const expandedIds = new Set<string>();
        elements.forEach((el) => {
          const bounds = getElementBounds(el);
          const hasOverlap = !(
            bounds.maxX < x1 ||
            bounds.minX > x2 ||
            bounds.maxY < y1 ||
            bounds.minY > y2
          );
          if (hasOverlap) {
            if (el.groupId) {
              elements
                .filter((e) => e.groupId === el.groupId)
                .forEach((member) => expandedIds.add(member.id));
            } else {
              expandedIds.add(el.id);
            }
          }
        });

        setSelectedIds(Array.from(expandedIds));
      }
      setSelectionBox(null);
      return;
    }

    // End laser drawing
    if (currentTool === 'laser' && isDrawing.current) {
      isDrawing.current = false;
      if (laserFadeTimeoutRef.current) clearTimeout(laserFadeTimeoutRef.current);
      laserFadeTimeoutRef.current = setTimeout(() => {
        setLocalLaserTrail([]);
        onUpdateLaserTrail?.(null);
      }, 1500);
      return;
    }

    if (!isDrawing.current || !newShape) return;
    isDrawing.current = false;

    // Normalize rect or frame with negative width/height
    let finalShape = newShape;
    if (finalShape.type === 'rect' || finalShape.type === 'frame') {
      let x = finalShape.x;
      let y = finalShape.y;
      let w = (finalShape as any).width;
      let h = (finalShape as any).height;

      if (w < 0) {
        x += w;
        w = Math.abs(w);
      }
      if (h < 0) {
        y += h;
        h = Math.abs(h);
      }

      if (w < 4 && h < 4) {
        setNewShape(null);
        return;
      }

      finalShape = {
        ...finalShape,
        x,
        y,
        width: w,
        height: h,
      } as any;
    } else if (finalShape.type === 'pen' && finalShape.points.length < 4) {
      setNewShape(null);
      return;
    }

    onSetElement(finalShape);
    setSelectedIds([finalShape.id]);
    setNewShape(null);
    onSetTool('select');
  };

  // Element selection handler
  const handleSelectElement = (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (currentTool === 'eraser') {
      const el = elements.find((item) => item.id === id);
      if (el && !el.locked) {
        onDeleteElement(id);
      }
      return;
    }

    if (currentTool !== 'select') return;

    const isShiftOrMeta = e.evt.shiftKey || (e.evt as MouseEvent).metaKey || (e.evt as MouseEvent).ctrlKey;
    const targetEl = elements.find((el) => el.id === id);
    if (!targetEl) return;

    // Expand to all group members if the element belongs to a group
    const groupMemberIds = targetEl.groupId
      ? elements.filter((el) => el.groupId === targetEl.groupId).map((el) => el.id)
      : [id];

    if (isShiftOrMeta) {
      setSelectedIds((prev) => {
        const hasAll = groupMemberIds.every((mId) => prev.includes(mId));
        return hasAll
          ? prev.filter((item) => !groupMemberIds.includes(item))
          : Array.from(new Set([...prev, ...groupMemberIds]));
      });
    } else {
      // Preserve selection if clicking within an already selected multi-element set
      setSelectedIds((prev) => (prev.includes(id) && prev.length > 1 ? prev : groupMemberIds));
    }
  };

  // Multi-element & group drag start handler
  const handleElementDragStart = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const draggedEl = elements.find((el) => el.id === id);
    if (!draggedEl) return;

    // 1. Determine all participating items in the drag
    let draggingIds = selectedIds.includes(id) ? [...selectedIds] : [id];
    if (draggedEl.groupId && !selectedIds.includes(id)) {
      draggingIds = elements.filter((el) => el.groupId === draggedEl.groupId).map((el) => el.id);
      setSelectedIds(draggingIds);
    }

    // 2. Expand group members for ALL elements participating in the drag
    const groupIdsInDrag = new Set<string>();
    draggingIds.forEach((elId) => {
      const el = elements.find((item) => item.id === elId);
      if (el?.groupId) groupIdsInDrag.add(el.groupId);
    });
    if (groupIdsInDrag.size > 0) {
      const allGroupMemberIds = elements
        .filter((el) => el.groupId && groupIdsInDrag.has(el.groupId))
        .map((el) => el.id);
      draggingIds = Array.from(new Set([...draggingIds, ...allGroupMemberIds]));
    }

    // 3. If ANY participating element is locked, cancel drag immediately
    const hasLocked = draggingIds.some((elId) => {
      const el = elements.find((item) => item.id === elId);
      return el?.locked === true;
    });

    if (hasLocked) {
      e.target.stopDrag();
      // Snap node back to initial coordinate to eliminate any mousemove offset jitter
      if (draggedEl.type === 'pen' || draggedEl.type === 'arrow' || draggedEl.type === 'line') {
        e.target.position({ x: 0, y: 0 });
      } else {
        e.target.position({ x: draggedEl.x, y: draggedEl.y });
      }
      dragStartPositionsRef.current.clear();
      return;
    }

    // 4. Register initial positions for all drag participants
    dragStartPositionsRef.current.clear();
    draggingIds.forEach((elId) => {
      const el = elements.find((item) => item.id === elId);
      if (!el) return;
      const node = layerRef.current?.findOne(`#${elId}`) as Konva.Node | undefined;
      dragStartPositionsRef.current.set(elId, {
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        points: 'points' in el && Array.isArray((el as any).points) ? [...(el as any).points] : undefined,
        nodeInitialPos: node ? { x: node.x(), y: node.y() } : { x: el.x, y: el.y },
      });
    });
  };

  // Multi-element & group drag move handler (translates companion nodes in real-time)
  const handleElementDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const leaderInitial = dragStartPositionsRef.current.get(id);
    if (!leaderInitial) return;

    let targetX = e.target.x();
    let targetY = e.target.y();

    // Smart Snapping & Alignment Guides (if enabled)
    if (snapToObjects) {
      const draggedEl = elements.find((item) => item.id === id);
      if (draggedEl) {
        const tempEl: CanvasElement = { ...draggedEl, x: targetX, y: targetY };
        const draggedBounds = computeElementBounds(tempEl);
        const otherEls = elements.filter(
          (item) => item.id !== id && !dragStartPositionsRef.current.has(item.id)
        );
        const snap = calculateSnapping(draggedBounds, otherEls, 5);

        if (snap.snappedX !== undefined) {
          targetX = snap.snappedX;
          e.target.x(targetX);
        }
        if (snap.snappedY !== undefined) {
          targetY = snap.snappedY;
          e.target.y(targetY);
        }
        setAlignmentGuides(snap.guides);
      }
    } else {
      setAlignmentGuides([]);
    }

    const dx = targetX - leaderInitial.nodeInitialPos.x;
    const dy = targetY - leaderInitial.nodeInitialPos.y;

    dragStartPositionsRef.current.forEach((initial, elId) => {
      if (elId === id) return;
      const node = layerRef.current?.findOne(`#${elId}`) as Konva.Node | undefined;
      if (node) {
        node.position({
          x: initial.nodeInitialPos.x + dx,
          y: initial.nodeInitialPos.y + dy,
        });
      }
    });

    layerRef.current?.batchDraw();
  };

  // Multi-element & group drag end handler (commits batch atomically via onSetBatchElements)
  const handleElementDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    setAlignmentGuides([]); // Clear snapping guides on drag end
    const leaderInitial = dragStartPositionsRef.current.get(id);
    if (!leaderInitial) {
      // If drag was aborted/stopped due to a locked element, snap node back and commit nothing
      const el = elements.find((item) => item.id === id);
      if (el) {
        if (el.type === 'pen' || el.type === 'arrow' || el.type === 'line') {
          e.target.position({ x: 0, y: 0 });
        } else {
          e.target.position({ x: el.x, y: el.y });
        }
      }
      return;
    }

    const dx = e.target.x() - leaderInitial.nodeInitialPos.x;
    const dy = e.target.y() - leaderInitial.nodeInitialPos.y;

    if (dx === 0 && dy === 0) {
      dragStartPositionsRef.current.clear();
      return;
    }

    const updatedElements: CanvasElement[] = [];

    dragStartPositionsRef.current.forEach((initial, elId) => {
      const el = elements.find((item) => item.id === elId);
      if (!el) return;

      if (el.type === 'pen' || el.type === 'arrow' || el.type === 'line') {
        const updatedPoints = (initial.points || []).map((p, i) =>
          i % 2 === 0 ? p + dx : p + dy
        );
        const node = layerRef.current?.findOne(`#${elId}`) as Konva.Node | undefined;
        node?.position({ x: 0, y: 0 }); // reset node offset
        updatedElements.push({
          ...el,
          points: updatedPoints,
          updatedAt: Date.now(),
        } as CanvasElement);
      } else {
        updatedElements.push({
          ...el,
          x: initial.x + dx,
          y: initial.y + dy,
          updatedAt: Date.now(),
        } as CanvasElement);
      }
    });

    // Update attached connectors for all moved elements
    let allToBatch = [...updatedElements];
    updatedElements.forEach((el) => {
      const attached = updateAttachedConnectors(el, elements);
      attached.forEach((att) => {
        const existingIdx = allToBatch.findIndex((b) => b.id === att.id);
        if (existingIdx >= 0) {
          allToBatch[existingIdx] = att;
        } else {
          allToBatch.push(att);
        }
      });
    });

    // If dragged element is a Frame, move all its contained child elements by the same delta!
    const draggedEl = elements.find((el) => el.id === id);
    if (draggedEl && draggedEl.type === 'frame') {
      const movedWithChildren = moveFrameWithChildren(draggedEl as any, elements, dx, dy);
      const childChanges = movedWithChildren.filter(
        (m) => m.id !== id && !allToBatch.some((b) => b.id === m.id)
      );
      allToBatch = [...allToBatch, ...childChanges];
    }

    if (allToBatch.length === 1) {
      onSetElement(allToBatch[0]);
    } else if (allToBatch.length > 1) {
      onSetBatchElements(allToBatch);
    }

    dragStartPositionsRef.current.clear();
  };

  // Element attribute update (drag/transform) + connector auto-updates!
  const handleElementChange = (id: string, newAttrs: Partial<CanvasElement>) => {
    const existing = elements.find((el) => el.id === id);
    if (!existing) return;

    const updated = {
      ...existing,
      ...newAttrs,
      updatedAt: Date.now(),
    } as CanvasElement;

    onSetElement(updated);

    // Update any connected arrows / lines
    const attachedUpdated = updateAttachedConnectors(updated, elements);
    if (attachedUpdated.length > 0) {
      onSetBatchElements(attachedUpdated);
    }
  };

  // Inline editing initiation
  const handleStartEditing = (id: string, box: any) => {
    const el = elements.find((item) => item.id === id);
    if (!el) return;

    if (el.type === 'sticky') {
      setEditingItem({
        id: el.id,
        type: 'sticky',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        text: el.text,
        fontSize: el.fontSize,
        color: el.color,
      });
    } else if (el.type === 'text') {
      setEditingItem({
        id: el.id,
        type: 'text',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        text: el.text,
        fontSize: el.fontSize,
        fill: el.fill,
      });
    }
  };

  const commitInlineEdit = () => {
    if (!editingItem) return;

    const existing = elements.find((item) => item.id === editingItem.id);
    if (existing) {
      if (existing.type === 'sticky') {
        onSetElement({
          ...existing,
          text: editingItem.text,
        });
      } else if (existing.type === 'text') {
        onSetElement({
          ...existing,
          text: editingItem.text || 'Text',
        });
      }
    }
    setEditingItem(null);
  };

  // Selected Elements actions for Context Menu
  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

  const handleDuplicate = () => {
    const rawList = selectedElements.length > 0 ? selectedElements : (contextMenu?.targetElement ? [contextMenu.targetElement] : []);
    // Filter out locked elements: if all are locked, do not duplicate; if mixed, duplicate only unlocked elements
    const targetList = rawList.filter((el) => !el.locked);
    if (targetList.length === 0) return;

    const duplicates: CanvasElement[] = [];
    const newIds: string[] = [];
    const groupMap = new Map<string, string>();

    targetList.forEach((el) => {
      const newId = crypto.randomUUID();
      newIds.push(newId);

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

    onSetBatchElements(duplicates);
    setSelectedIds(newIds);
  };

  const handleCut = () => {
    const hasUnlocked = selectedIds.some((id) => !elements.find((el) => el.id === id)?.locked);
    if (hasUnlocked) {
      onCutElements();
    }
  };

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      const deletableIds = selectedIds.filter((id) => !elements.find((el) => el.id === id)?.locked);
      if (deletableIds.length > 0) {
        onDeleteElements(deletableIds);
        setSelectedIds((prev) => prev.filter((id) => !deletableIds.includes(id)));
      }
    } else if (contextMenu?.targetElement && !contextMenu.targetElement.locked) {
      onDeleteElement(contextMenu.targetElement.id);
    }
  };

  // Toggle Lock on Selection or Target
  const handleToggleLock = useCallback(() => {
    const targetList = selectedElements.length > 0
      ? selectedElements
      : (contextMenu?.targetElement ? [contextMenu.targetElement] : []);
    if (targetList.length === 0) return;
    const isAllLocked = targetList.every((el) => el.locked);
    const updated = targetList.map((el) => {
      const clone = { ...el, updatedAt: Date.now() };
      if (!isAllLocked) {
        clone.locked = true;
      } else {
        delete clone.locked;
      }
      return clone as CanvasElement;
    });
    onSetBatchElements(updated);
  }, [selectedElements, contextMenu, onSetBatchElements]);

  // Group Selection or Target
  const handleGroup = useCallback(() => {
    const targetList = selectedElements.length > 0
      ? selectedElements
      : (contextMenu?.targetElement ? [contextMenu.targetElement] : []);
    if (targetList.length < 2) return;
    const newGroupId = crypto.randomUUID();
    const updated = targetList.map((el) => ({
      ...el,
      groupId: newGroupId,
      updatedAt: Date.now(),
    } as CanvasElement));
    onSetBatchElements(updated);
    setSelectedIds(updated.map((el) => el.id));
  }, [selectedElements, contextMenu, onSetBatchElements, setSelectedIds]);

  // Ungroup Selection or Target
  const handleUngroup = useCallback(() => {
    const targetList = selectedElements.length > 0
      ? selectedElements
      : (contextMenu?.targetElement ? [contextMenu.targetElement] : []);
    const groupIdsToClear = new Set(
      targetList
        .map((el) => el.groupId)
        .filter((gid): gid is string => Boolean(gid))
    );
    if (groupIdsToClear.size === 0) return;
    const updated = elements
      .filter((el) => el.groupId && groupIdsToClear.has(el.groupId))
      .map((el) => {
        const clone = { ...el, updatedAt: Date.now() };
        delete clone.groupId;
        return clone as CanvasElement;
      });
    if (updated.length > 0) {
      onSetBatchElements(updated);
    }
  }, [elements, selectedElements, contextMenu, onSetBatchElements]);

  // Click-to-Unlock Single Element (Group-Aware)
  const handleUnlockElement = useCallback((elementId: string) => {
    const el = elements.find((item) => item.id === elementId);
    if (!el) return;
    if (el.groupId) {
      const groupMembers = elements.filter((item) => item.groupId === el.groupId);
      onSetBatchElements(
        groupMembers.map((item) => {
          const clone = { ...item, updatedAt: Date.now() };
          delete clone.locked;
          return clone as CanvasElement;
        })
      );
    } else {
      const clone = { ...el, updatedAt: Date.now() };
      delete clone.locked;
      onSetElement(clone as CanvasElement);
    }
  }, [elements, onSetElement, onSetBatchElements]);

  const handleBringToFront = () => {
    const maxZ = Math.max(...elements.map((el) => el.zIndex ?? 0), 0);
    selectedElements.forEach((el, index) => {
      onSetElement({
        ...el,
        zIndex: maxZ + 1 + index,
        updatedAt: Date.now(),
      });
    });
  };

  const handleSendToBack = () => {
    const minZ = Math.min(...elements.map((el) => el.zIndex ?? 0), 0);
    selectedElements.forEach((el, index) => {
      onSetElement({
        ...el,
        zIndex: minZ - 1 - (selectedElements.length - index),
        updatedAt: Date.now(),
      });
    });
  };

  const handleBringForward = () => {
    selectedElements.forEach((el) => {
      onSetElement({
        ...el,
        zIndex: (el.zIndex ?? 0) + 1,
        updatedAt: Date.now(),
      });
    });
  };

  const handleSendBackward = () => {
    selectedElements.forEach((el) => {
      onSetElement({
        ...el,
        zIndex: Math.max(0, (el.zIndex ?? 0) - 1),
        updatedAt: Date.now(),
      });
    });
  };

  const handleQuickAddSticky = (point: { x: number; y: number }, color: StickyColor = 'yellow') => {
    const newSticky: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'sticky',
      x: point.x - 85,
      y: point.y - 85,
      width: 170,
      height: 170,
      text: 'New Note',
      color,
      fontSize: 18,
      zIndex: getNextZIndex(),
      updatedAt: Date.now(),
    };
    onSetElement(newSticky);
    setSelectedIds([newSticky.id]);
    onSetTool('select');
  };

  const handleQuickAddText = (point: { x: number; y: number }) => {
    const newText: CanvasElement = {
      id: crypto.randomUUID(),
      type: 'text',
      x: point.x,
      y: point.y,
      text: 'Type text here...',
      fontSize: toolProperties.fontSize || 22,
      fontFamily: 'Inter, sans-serif',
      fill: toolProperties.strokeColor || '#f8fafc',
      zIndex: getNextZIndex(),
      updatedAt: Date.now(),
    };
    onSetElement(newText);
    setSelectedIds([newText.id]);
    onSetTool('select');
  };

  const handleQuickAddShape = (type: 'rect' | 'circle' | 'arrow' | 'line', point: { x: number; y: number }) => {
    const nextZ = getNextZIndex();
    let newEl: CanvasElement;

    if (type === 'rect') {
      newEl = {
        id: crypto.randomUUID(),
        type: 'rect',
        x: point.x - 70,
        y: point.y - 50,
        width: 140,
        height: 100,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        cornerRadius: 6,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    } else if (type === 'circle') {
      newEl = {
        id: crypto.randomUUID(),
        type: 'circle',
        x: point.x,
        y: point.y,
        radiusX: 60,
        radiusY: 60,
        fill: toolProperties.fillColor,
        stroke: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    } else if (type === 'arrow') {
      newEl = {
        id: crypto.randomUUID(),
        type: 'arrow',
        points: [point.x - 60, point.y - 40, point.x + 60, point.y + 40],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    } else {
      newEl = {
        id: crypto.randomUUID(),
        type: 'line',
        points: [point.x - 60, point.y, point.x + 60, point.y],
        color: toolProperties.strokeColor,
        strokeWidth: toolProperties.strokeWidth,
        x: 0,
        y: 0,
        zIndex: nextZ,
        updatedAt: Date.now(),
      };
    }

    onSetElement(newEl);
    setSelectedIds([newEl.id]);
    onSetTool('select');
  };

  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  const handleExportCurrentViewport = () => {
    if (stageRef.current) {
      exportStageToPNG(stageRef.current, {
        pixelRatio: 2,
        scope: 'viewport',
        fileName: `whiteboard-viewport-${Date.now()}.png`,
      });
    }
  };

  // Spacebar panning listener & hotkeys (relocated below handler definitions with complete dependencies)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea, input, or inline editing
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || editingItem) {
        return;
      }

      if (e.code === 'Space' && !e.repeat && !isSpacePressed) {
        setIsSpacePressed(true);
      }

      // Delete/Backspace: filter out locked elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const deletableIds = selectedIds.filter((id) => !elements.find((el) => el.id === id)?.locked);
        if (deletableIds.length > 0) {
          onDeleteElements(deletableIds);
          setSelectedIds((prev) => prev.filter((id) => !deletableIds.includes(id)));
        }
      }

      // Escape
      if (e.key === 'Escape') {
        setSelectedIds([]);
        if (editingItem) {
          commitInlineEdit();
        }
        setContextMenu(null);
        onSetTool('select');
      }

      // Select all (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
        onSetTool('select');
      }

      // Copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        onCopyElements();
      }

      // Cut (Ctrl+X / Cmd+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedIds.length > 0) {
        e.preventDefault();
        handleCut();
      }

      // Layer ordering shortcuts: [ and ]
      if (e.key === ']' && selectedIds.length > 0) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleBringToFront();
        } else {
          handleBringForward();
        }
      }
      if (e.key === '[' && selectedIds.length > 0) {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          handleSendToBack();
        } else {
          handleSendBackward();
        }
      }

      // Duplicate (Ctrl+D / Cmd+D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        handleDuplicate();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedIds,
    elements,
    editingItem,
    isSpacePressed,
    onDeleteElements,
    setSelectedIds,
    onSetTool,
    onCopyElements,
    onCutElements,
    handleBringToFront,
    handleBringForward,
    handleSendToBack,
    handleSendBackward,
    handleDuplicate,
    commitInlineEdit,
  ]);

  // Drag & Drop image onto canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    stage.setPointersPositions(e);
    const point = getCanvasPoint(stage);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result as string;
        const img = new window.Image();
        img.src = src;
        img.onload = () => {
          const maxDim = 320;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = width * ratio;
            height = height * ratio;
          }

          const newImageEl: CanvasElement = {
            id: crypto.randomUUID(),
            type: 'image',
            src,
            x: point.x - width / 2,
            y: point.y - height / 2,
            width,
            height,
            zIndex: getNextZIndex(),
            updatedAt: Date.now(),
          };

          onSetElement(newImageEl);
          setSelectedIds([newImageEl.id]);
          onSetTool('select');
        };
      };
      reader.readAsDataURL(file);
    });
  };

  // Cursor style
  let cursorStyle = 'default';
  if (isSpacePressed || currentTool === 'pan') {
    cursorStyle = isPanning ? 'grabbing' : 'grab';
  } else if (currentTool === 'pen') {
    cursorStyle = 'crosshair';
  } else if (['rect', 'circle', 'arrow', 'line'].includes(currentTool)) {
    cursorStyle = 'crosshair';
  } else if (currentTool === 'sticky' || currentTool === 'text') {
    cursorStyle = 'text';
  } else if (currentTool === 'eraser') {
    cursorStyle = 'cell';
  }

  const isDark = theme === 'dark';

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${
        isDark ? 'bg-slate-950' : 'bg-slate-50'
      }`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onMouseLeave={() => onUpdateCursor(null)}
      style={{ cursor: cursorStyle }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        {/* Layer 1: Static Background Grid (listening={false} isolates dot redraws) */}
        <Layer id="grid-layer" listening={false}>
          <GridBackground
            width={stageSize.width}
            height={stageSize.height}
            scale={stageScale}
            stageX={stagePos.x}
            stageY={stagePos.y}
            gridType={gridType}
            theme={theme}
          />
        </Layer>

        {/* Layer 2: Main Interactive Content Layer */}
        <Layer id="elements-layer" ref={layerRef}>
          {elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              isSelected={selectedIds.includes(el.id)}
              onSelect={handleSelectElement}
              onChange={handleElementChange}
              onDragStart={handleElementDragStart}
              onDragMove={handleElementDragMove}
              onDragEnd={handleElementDragEnd}
              onStartEditing={handleStartEditing}
              isEditing={editingItem?.id === el.id}
            />
          ))}

          {/* Active drawing shape preview */}
          {newShape && (
            <>
              {newShape.type === 'pen' && (
                <KonvaLine
                  points={newShape.points}
                  stroke={newShape.color}
                  strokeWidth={newShape.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              {newShape.type === 'rect' && (
                <KonvaRect
                  x={newShape.x}
                  y={newShape.y}
                  width={newShape.width}
                  height={newShape.height}
                  fill={newShape.fill}
                  stroke={newShape.stroke}
                  strokeWidth={newShape.strokeWidth}
                  cornerRadius={4}
                />
              )}
              {newShape.type === 'circle' && (
                <KonvaCircle
                  x={newShape.x}
                  y={newShape.y}
                  radiusX={newShape.radiusX}
                  radiusY={newShape.radiusY}
                  fill={newShape.fill}
                  stroke={newShape.stroke}
                  strokeWidth={newShape.strokeWidth}
                />
              )}
              {newShape.type === 'arrow' && (
                <KonvaArrow
                  points={newShape.points}
                  stroke={newShape.color}
                  fill={newShape.color}
                  strokeWidth={newShape.strokeWidth}
                  pointerLength={10}
                  pointerWidth={10}
                />
              )}
              {newShape.type === 'line' && (
                <KonvaLine
                  points={newShape.points}
                  stroke={newShape.color}
                  strokeWidth={newShape.strokeWidth}
                  lineCap="round"
                />
              )}
            </>
          )}

          {/* Magnetic Shape Connection Points */}
          <ConnectorAnchors
            anchors={allConnectorAnchors}
            activeAnchor={activeSnapAnchor}
            visible={showConnectorAnchors}
          />

          {/* Drag Selection Box */}
          {selectionBox && (
            <KonvaRect
              x={Math.min(selectionBox.x1, selectionBox.x2)}
              y={Math.min(selectionBox.y1, selectionBox.y2)}
              width={Math.abs(selectionBox.x2 - selectionBox.x1)}
              height={Math.abs(selectionBox.y2 - selectionBox.y1)}
              fill="rgba(99, 102, 241, 0.15)"
              stroke="#6366f1"
              strokeWidth={1 / stageScale}
              dash={[4 / stageScale, 4 / stageScale]}
            />
          )}

          {/* Konva Transformer (Locks resize & rotation if any selected element is locked) */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
                return oldBox;
              }
              return newBox;
            }}
            resizeEnabled={!isSelectionLocked}
            rotateEnabled={!isSelectionLocked}
            enabledAnchors={
              isSelectionLocked
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
                  ]
            }
            borderStroke={isSelectionLocked ? '#f59e0b' : '#6366f1'}
            borderDash={isSelectionLocked ? [2, 2] : [4, 4]}
            anchorSize={9}
            anchorCornerRadius={3}
            anchorStroke="#6366f1"
            anchorFill="#ffffff"
          />
        </Layer>

        {/* Layer 3: Dynamic Alignment Guides Overlay (listening={false}) */}
        <Layer id="guides-overlay-layer" listening={false}>
          {alignmentGuides.map((guide, idx) => (
            <KonvaLine
              key={`guide-${idx}`}
              points={guide.points}
              stroke="#ec4899"
              strokeWidth={1 / stageScale}
              dash={[4 / stageScale, 4 / stageScale]}
              listening={false}
            />
          ))}
        </Layer>

        {/* Layer 4: Ephemeral Collaboration Layer (listening={false}) */}
        <Layer id="ephemeral-layer" listening={false}>
          {/* Local Laser Trail */}
          {localLaserTrail.length >= 4 && (
            <KonvaLine
              points={localLaserTrail}
              stroke="#ef4444"
              strokeWidth={4}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              shadowColor="#ef4444"
              shadowBlur={12}
              shadowOpacity={0.8}
              listening={false}
            />
          )}

          <PeerCursors collaborators={collaborators} />
        </Layer>
      </Stage>

      {/* Floating Badges for Object Reactions & Comment Counts & Lock Status */}
      <ObjectOverlayBadges
        elements={elements}
        comments={comments}
        stagePos={stagePos}
        stageScale={stageScale}
        theme={theme}
        localUserId={localUser.id}
        selectedIds={selectedIds}
        onToggleReaction={onToggleReaction}
        onOpenEmojiPicker={onOpenEmojiPicker}
        onOpenComments={onOpenComments}
        onUnlockElement={handleUnlockElement}
      />

      {/* Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canvasPoint={contextMenu.canvasPoint}
          targetElement={contextMenu.targetElement}
          selectedElements={selectedElements}
          onClose={() => setContextMenu(null)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
          onToggleLock={handleToggleLock}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onExportFrame={(frameId) => {
            const frameEl = elements.find((e) => e.id === frameId);
            if (frameEl && stageRef.current) {
              exportStageToPNG(stageRef.current, {
                fileName: `${(frameEl as any).title || 'frame'}.png`,
                pixelRatio: 2,
                scope: 'selection',
                selectedIds: [frameId],
              });
            }
          }}
          onEditItem={() => {
            if (contextMenu.targetElement) {
              const el = contextMenu.targetElement;
              handleStartEditing(el.id, {
                x: el.x * stageScale + stagePos.x,
                y: el.y * stageScale + stagePos.y,
                width: ((el as any).width || 120) * stageScale,
                height: ((el as any).height || 60) * stageScale,
                text: (el as any).text || '',
                fontSize: ((el as any).fontSize || 18) * stageScale,
                color: (el as any).color,
                fill: (el as any).fill,
              });
            }
          }}
          onChangeColor={(col) => {
            if (contextMenu.targetElement && contextMenu.targetElement.type === 'sticky') {
              onSetElement({
                ...contextMenu.targetElement,
                color: col as StickyColor,
                updatedAt: Date.now(),
              });
            }
          }}
          onAddSticky={handleQuickAddSticky}
          onAddText={handleQuickAddText}
          onAddShape={handleQuickAddShape}
          onSelectAll={() => {
            setSelectedIds(elements.map((el) => el.id));
            onSetTool('select');
          }}
          onResetZoom={handleResetZoom}
          onExportViewport={handleExportCurrentViewport}
          onUploadImage={onUploadImagePrompt}
          onCopy={onCopyElements}
          onCut={handleCut}
          onPaste={onPasteElements}
          hasClipboard={clipboard.length > 0}
          onToggleReaction={onToggleReaction}
          onOpenComments={onOpenComments}
        />
      )}

      {/* Floating HTML Overlay for Double-Click Inline Text Editing */}
      {editingItem && (
        <div
          className="absolute z-40 pointer-events-auto"
          style={{
            left: `${editingItem.x}px`,
            top: `${editingItem.y}px`,
            width: `${editingItem.width}px`,
            height: `${editingItem.height}px`,
          }}
        >
          <textarea
            ref={textareaRef}
            value={editingItem.text}
            onChange={(e) => setEditingItem({ ...editingItem, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                commitInlineEdit();
              }
              if (editingItem.type === 'text' && e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commitInlineEdit();
              }
            }}
            onBlur={commitInlineEdit}
            className={`w-full h-full resize-none outline-none border-2 border-indigo-500 rounded p-2 bg-transparent leading-relaxed ${
              editingItem.type === 'sticky'
                ? "font-['Caveat'] font-semibold text-slate-900"
                : isDark ? 'font-sans font-medium text-slate-100' : 'font-sans font-medium text-slate-900'
            }`}
            style={{
              fontSize: `${Math.max(12, editingItem.fontSize)}px`,
              color: editingItem.type === 'sticky' ? '#0f172a' : editingItem.fill || (isDark ? '#f8fafc' : '#0f172a'),
            }}
          />
        </div>
      )}
    </div>
  );
};
