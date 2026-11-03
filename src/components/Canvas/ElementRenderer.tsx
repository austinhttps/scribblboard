import React from 'react';
import { Line, Rect, Circle, Arrow } from 'react-konva';
import { CanvasElement } from '../../types/whiteboard';
import { StickyNote } from './StickyNote';
import { TextItem } from './TextItem';
import { URLImage } from './URLImage';
import Konva from 'konva';

interface ElementRendererProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (id: string, newAttrs: Partial<CanvasElement>) => void;
  onDragStart?: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (id: string, e: Konva.KonvaEventObject<DragEvent>) => void;
  onStartEditing: (id: string, stageBox: any) => void;
  isEditing: boolean;
}

export const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  onStartEditing,
  isEditing,
}) => {
  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    onSelect(element.id, e);
  };

  const handleChange = (newAttrs: Partial<CanvasElement>) => {
    onChange(element.id, newAttrs);
  };

  switch (element.type) {
    case 'pen':
      return (
        <Line
          id={element.id}
          points={element.points}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          tension={0.5}
          lineCap="round"
          lineJoin="round"
          draggable={!element.locked}
          onClick={handleSelect}
          onTap={handleSelect}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              const dx = e.target.x();
              const dy = e.target.y();
              e.target.position({ x: 0, y: 0 }); // reset node offset
              const updatedPoints = element.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy));
              handleChange({
                points: updatedPoints,
              });
            }
          }}
        />
      );

    case 'rect':
      return (
        <Rect
          id={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          cornerRadius={element.cornerRadius || 4}
          rotation={element.rotation || 0}
          shadowColor="black"
          shadowBlur={isSelected ? 10 : 2}
          shadowOpacity={isSelected ? 0.25 : 0.05}
          shadowOffsetY={2}
          draggable={!element.locked}
          onClick={handleSelect}
          onTap={handleSelect}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              handleChange({
                x: e.target.x(),
                y: e.target.y(),
              });
            }
          }}
          onTransformEnd={(e) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            node.scaleX(1);
            node.scaleY(1);

            handleChange({
              x: node.x(),
              y: node.y(),
              width: Math.max(10, node.width() * scaleX),
              height: Math.max(10, node.height() * scaleY),
              rotation: node.rotation(),
            });
          }}
        />
      );

    case 'circle':
      return (
        <Circle
          id={element.id}
          x={element.x}
          y={element.y}
          radiusX={element.radiusX}
          radiusY={element.radiusY}
          fill={element.fill}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          rotation={element.rotation || 0}
          shadowColor="black"
          shadowBlur={isSelected ? 10 : 2}
          shadowOpacity={isSelected ? 0.25 : 0.05}
          shadowOffsetY={2}
          draggable={!element.locked}
          onClick={handleSelect}
          onTap={handleSelect}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              handleChange({
                x: e.target.x(),
                y: e.target.y(),
              });
            }
          }}
          onTransformEnd={(e) => {
            const node = e.target;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            node.scaleX(1);
            node.scaleY(1);

            handleChange({
              x: node.x(),
              y: node.y(),
              radiusX: Math.max(5, (element.radiusX || 20) * scaleX),
              radiusY: Math.max(5, (element.radiusY || 20) * scaleY),
              rotation: node.rotation(),
            });
          }}
        />
      );

    case 'arrow':
      return (
        <Arrow
          id={element.id}
          points={element.points}
          stroke={element.color}
          fill={element.color}
          strokeWidth={element.strokeWidth}
          pointerLength={element.pointerLength || 10}
          pointerWidth={element.pointerWidth || 10}
          draggable={!element.locked}
          onClick={handleSelect}
          onTap={handleSelect}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              const dx = e.target.x();
              const dy = e.target.y();
              e.target.position({ x: 0, y: 0 });
              const updatedPoints = element.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy));
              handleChange({
                points: updatedPoints,
              });
            }
          }}
        />
      );

    case 'line':
      return (
        <Line
          id={element.id}
          points={element.points}
          stroke={element.color}
          strokeWidth={element.strokeWidth}
          lineCap="round"
          draggable={!element.locked}
          onClick={handleSelect}
          onTap={handleSelect}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              const dx = e.target.x();
              const dy = e.target.y();
              e.target.position({ x: 0, y: 0 });
              const updatedPoints = element.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy));
              handleChange({
                points: updatedPoints,
              });
            }
          }}
        />
      );

    case 'sticky':
      return (
        <StickyNote
          element={element}
          isSelected={isSelected}
          onSelect={handleSelect}
          onChange={handleChange}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              handleChange({ x: e.target.x(), y: e.target.y() });
            }
          }}
          onStartEditing={onStartEditing}
          isEditing={isEditing}
        />
      );

    case 'text':
      return (
        <TextItem
          element={element}
          isSelected={isSelected}
          onSelect={handleSelect}
          onChange={handleChange}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              handleChange({ x: e.target.x(), y: e.target.y() });
            }
          }}
          onStartEditing={onStartEditing}
          isEditing={isEditing}
        />
      );

    case 'image':
      return (
        <URLImage
          element={element}
          isSelected={isSelected}
          onSelect={handleSelect}
          onChange={handleChange}
          onDragStart={(e) => onDragStart?.(element.id, e)}
          onDragMove={(e) => onDragMove?.(element.id, e)}
          onDragEnd={(e) => {
            if (onDragEnd) {
              onDragEnd(element.id, e);
            } else {
              handleChange({ x: e.target.x(), y: e.target.y() });
            }
          }}
        />
      );

    default:
      return null;
  }
};
