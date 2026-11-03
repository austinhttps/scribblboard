import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { StickyElement, StickyColor } from '../../types/whiteboard';
import Konva from 'konva';

const STICKY_COLORS: Record<StickyColor, { bg: string; border: string; text: string; header: string }> = {
  yellow: { bg: '#fef08a', border: '#fde047', text: '#713f12', header: '#facc15' },
  pink: { bg: '#fbcfe8', border: '#f472b6', text: '#831843', header: '#f472b6' },
  blue: { bg: '#bae6fd', border: '#7dd3fc', text: '#0c4a6e', header: '#38bdf8' },
  green: { bg: '#bbf7d0', border: '#86efac', text: '#14532d', header: '#4ade80' },
  purple: { bg: '#e9d5ff', border: '#d8b4fe', text: '#581c87', header: '#c084fc' },
  orange: { bg: '#fed7aa', border: '#fdba74', text: '#7c2d12', header: '#fb923c' },
};

interface StickyNoteProps {
  element: StickyElement;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (newAttrs: Partial<StickyElement>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onStartEditing: (id: string, stageBox: { x: number; y: number; width: number; height: number; text: string; fontSize: number; color: StickyColor }) => void;
  isEditing: boolean;
}

export const StickyNote: React.FC<StickyNoteProps> = ({
  element,
  isSelected: _isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragMove,
  onDragEnd,
  onStartEditing,
  isEditing,
}) => {
  const groupRef = useRef<Konva.Group>(null);
  const colorTheme = STICKY_COLORS[element.color] || STICKY_COLORS.yellow;

  const handleDoubleClick = () => {
    if (!groupRef.current) return;
    const stage = groupRef.current.getStage();
    if (!stage) return;

    const groupNode = groupRef.current;
    const transform = groupNode.getAbsoluteTransform();
    const pos = transform.point({ x: 0, y: 0 });

    onStartEditing(element.id, {
      x: pos.x,
      y: pos.y,
      width: element.width * stage.scaleX(),
      height: element.height * stage.scaleY(),
      text: element.text,
      fontSize: element.fontSize * stage.scaleX(),
      color: element.color,
    });
  };

  return (
    <Group
      ref={groupRef}
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation || 0}
      draggable={!element.locked && !isEditing}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={handleDoubleClick}
      onDblTap={handleDoubleClick}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        if (onDragEnd) {
          onDragEnd(e);
        } else {
          onChange({
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

        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(80, node.width() * scaleX),
          height: Math.max(80, node.height() * scaleY),
          rotation: node.rotation(),
        });
      }}
    >
      {/* Post-it Base Card with Shadow */}
      <Rect
        width={element.width}
        height={element.height}
        fill={colorTheme.bg}
        stroke={colorTheme.border}
        strokeWidth={1}
        cornerRadius={8}
        shadowColor="black"
        shadowBlur={12}
        shadowOpacity={0.15}
        shadowOffsetY={4}
      />

      {/* Top Tape Accent Strip */}
      <Rect
        x={12}
        y={0}
        width={element.width - 24}
        height={4}
        fill={colorTheme.header}
        opacity={0.7}
        cornerRadius={[2, 2, 0, 0]}
      />

      {/* Text Content */}
      {!isEditing && (
        <Text
          x={14}
          y={16}
          width={element.width - 28}
          height={element.height - 30}
          text={element.text || 'Double-click to write note...'}
          fontSize={element.fontSize || 16}
          fontFamily="'Caveat', cursive, sans-serif"
          fill={element.text ? colorTheme.text : 'rgba(0,0,0,0.35)'}
          lineHeight={1.3}
          wrap="word"
          ellipsis={true}
        />
      )}
    </Group>
  );
};
