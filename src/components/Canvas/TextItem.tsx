import React, { useRef } from 'react';
import { Text as KonvaText } from 'react-konva';
import { TextElement } from '../../types/whiteboard';
import Konva from 'konva';

interface TextItemProps {
  element: TextElement;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (newAttrs: Partial<TextElement>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onStartEditing: (id: string, stageBox: { x: number; y: number; width: number; height: number; text: string; fontSize: number; fill: string }) => void;
  isEditing: boolean;
}

export const TextItem: React.FC<TextItemProps> = ({
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
  const textRef = useRef<Konva.Text>(null);

  const handleDoubleClick = () => {
    if (!textRef.current) return;
    const stage = textRef.current.getStage();
    if (!stage) return;

    const node = textRef.current;
    const transform = node.getAbsoluteTransform();
    const pos = transform.point({ x: 0, y: 0 });

    onStartEditing(element.id, {
      x: pos.x,
      y: pos.y,
      width: Math.max(100, node.width() * stage.scaleX()),
      height: Math.max(30, node.height() * stage.scaleY()),
      text: element.text,
      fontSize: element.fontSize * stage.scaleX(),
      fill: element.fill,
    });
  };

  return (
    <KonvaText
      ref={textRef}
      id={element.id}
      x={element.x}
      y={element.y}
      text={isEditing ? '' : (element.text || 'Text')}
      fontSize={element.fontSize || 20}
      fontFamily={element.fontFamily || 'Inter, sans-serif'}
      fill={element.fill || '#f8fafc'}
      width={element.width}
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

        node.scaleX(1);
        node.scaleY(1);

        onChange({
          x: node.x(),
          y: node.y(),
          width: Math.max(40, node.width() * scaleX),
          rotation: node.rotation(),
        });
      }}
    />
  );
};
