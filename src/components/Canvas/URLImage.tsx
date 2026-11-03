import { useEffect, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import { ImageElement } from '../../types/whiteboard';

import Konva from 'konva';

interface URLImageProps {
  element: ImageElement;
  isSelected: boolean;
  onSelect: (e: any) => void;
  onChange: (newAttrs: Partial<ImageElement>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

export function URLImage({
  element,
  isSelected: _isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragMove,
  onDragEnd,
}: URLImageProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = element.src;
    img.onload = () => {
      setImage(img);
    };
  }, [element.src]);

  return (
    <KonvaImage
      id={element.id}
      image={image || undefined}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation || 0}
      draggable={!element.locked}
      onClick={onSelect}
      onTap={onSelect}
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
          width: Math.max(20, node.width() * scaleX),
          height: Math.max(20, node.height() * scaleY),
          rotation: node.rotation(),
        });
      }}
    />
  );
}
