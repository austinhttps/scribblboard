import React from 'react';
import { Group, Path, Text, Rect, Line as KonvaLine } from 'react-konva';
import { Collaborator } from '../../types/whiteboard';

interface PeerCursorsProps {
  collaborators: Collaborator[];
}

export const PeerCursors: React.FC<PeerCursorsProps> = ({ collaborators }) => {
  return (
    <Group listening={false}>
      {/* Remote Laser Trails */}
      {collaborators.map((collab) => {
        if (!collab.laserTrail || !collab.laserTrail.points || collab.laserTrail.points.length < 4) return null;
        const trailAge = Date.now() - (collab.laserTrail.timestamp || 0);
        if (trailAge > 1500) return null;

        const opacity = Math.max(0, 1 - trailAge / 1500);

        return (
          <KonvaLine
            key={`peer-laser-${collab.clientId}`}
            points={collab.laserTrail.points}
            stroke={collab.laserTrail.color || '#ef4444'}
            strokeWidth={4}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
            shadowColor={collab.laserTrail.color || '#ef4444'}
            shadowBlur={12}
            shadowOpacity={0.8 * opacity}
            opacity={opacity}
            listening={false}
          />
        );
      })}

      {collaborators.map((collab) => {
        if (!collab.cursor) return null;

        const { x, y } = collab.cursor;
        const color = collab.color || '#6366f1';
        const name = collab.name || 'Collaborator';

        return (
          <Group key={`peer-cursor-${collab.clientId}`} x={x} y={y} listening={false}>
            {/* SVG Pointer Arrow */}
            <Path
              data="M0,0 L0,18 L4.5,13.5 L9.5,22 L12.5,20.5 L7.5,12 L14,12 Z"
              fill={color}
              stroke="#0f172a"
              strokeWidth={1.5}
              shadowColor="black"
              shadowBlur={6}
              shadowOpacity={0.4}
              shadowOffsetY={2}
            />

            {/* Name Tag Badge */}
            <Group x={14} y={16} listening={false}>
              <Rect
                width={Math.max(60, name.length * 7 + 16)}
                height={20}
                fill={color}
                cornerRadius={6}
                shadowColor="black"
                shadowBlur={6}
                shadowOpacity={0.3}
                shadowOffsetY={1}
              />
              <Text
                x={8}
                y={4}
                text={name}
                fontSize={11}
                fontFamily="Inter, sans-serif"
                fontStyle="600"
                fill="#ffffff"
              />
            </Group>
          </Group>
        );
      })}
    </Group>
  );
};
