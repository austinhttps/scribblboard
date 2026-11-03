import React, { useRef, useEffect } from 'react';
import { CanvasElement, ThemeMode } from '../../types/whiteboard';
import { computeBoardBounds, computeMinimapViewportBox, minimapPointToCanvasViewport } from '../../utils/canvasTools';
import { Map, ChevronDown, ChevronUp } from 'lucide-react';

interface MinimapProps {
  elements: CanvasElement[];
  viewport: { x: number; y: number; width: number; height: number; scale: number };
  onNavigate: (newViewport: { x: number; y: number }) => void;
  theme: ThemeMode;
}

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;

export const Minimap: React.FC<MinimapProps> = ({
  elements,
  viewport,
  onNavigate,
  theme,
}) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = theme === 'dark';

  const boardBounds = computeBoardBounds(elements);
  const viewportBox = computeMinimapViewportBox(viewport, boardBounds, {
    width: MINIMAP_WIDTH,
    height: MINIMAP_HEIGHT,
  });

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    const scaleX = MINIMAP_WIDTH / Math.max(boardBounds.width, 1);
    const scaleY = MINIMAP_HEIGHT / Math.max(boardBounds.height, 1);
    const scale = Math.min(scaleX, scaleY);

    // Draw elements thumbnail
    ctx.fillStyle = isDark ? '#475569' : '#94a3b8';
    elements.forEach((el) => {
      const ex = (el.x - boardBounds.minX) * scale;
      const ey = (el.y - boardBounds.minY) * scale;
      const ew = Math.max(2, ((el as any).width || 40) * scale);
      const eh = Math.max(2, ((el as any).height || 40) * scale);

      if (el.type === 'frame') {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(ex, ey, ew, eh);
      } else if (el.type === 'sticky') {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(ex, ey, ew, eh);
      } else {
        ctx.fillStyle = isDark ? '#64748b' : '#cbd5e1';
        ctx.fillRect(ex, ey, ew, eh);
      }
    });

    // Draw Viewport Highlight Box
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.fillRect(viewportBox.x, viewportBox.y, viewportBox.width, viewportBox.height);
    ctx.strokeRect(viewportBox.x, viewportBox.y, viewportBox.width, viewportBox.height);
  }, [elements, viewport, boardBounds, viewportBox, isDark, isOpen]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const newVp = minimapPointToCanvasViewport(
      clickPoint,
      { width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT },
      boardBounds,
      viewport
    );
    onNavigate(newVp);
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-30 flex flex-col rounded-xl overflow-hidden shadow-2xl border backdrop-blur-md transition-all ${
        isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white/95 border-slate-200'
      }`}
    >
      <div
        className={`flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs font-semibold select-none ${
          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-1.5">
          <Map className="w-3.5 h-3.5 text-indigo-500" />
          <span>Radar</span>
        </div>
        <button className="p-0.5 hover:text-indigo-400">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isOpen && (
        <canvas
          ref={canvasRef}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          onClick={handleMinimapClick}
          className="cursor-crosshair block"
        />
      )}
    </div>
  );
};
