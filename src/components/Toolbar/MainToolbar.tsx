import React, { useRef } from 'react';
import {
  MousePointer,
  Hand,
  Pencil,
  Square,
  Circle,
  ArrowUpRight,
  Minus,
  StickyNote,
  Type,
  Eraser,
  Image as ImageIcon,
  Frame,
  Zap,
} from 'lucide-react';
import { ToolType, ThemeMode } from '../../types/whiteboard';

interface MainToolbarProps {
  currentTool: ToolType;
  theme: ThemeMode;
  onSelectTool: (tool: ToolType) => void;
  onUploadImage: (file: File) => void;
}

export const MainToolbar: React.FC<MainToolbarProps> = ({
  currentTool,
  theme,
  onSelectTool,
  onUploadImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  const tools: { id: ToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Select & Move', icon: <MousePointer className="w-5 h-5" />, shortcut: 'V' },
    { id: 'pan', label: 'Hand / Pan', icon: <Hand className="w-5 h-5" />, shortcut: 'H' },
    { id: 'laser', label: 'Laser Pointer', icon: <Zap className="w-5 h-5" />, shortcut: 'K' },
    { id: 'pen', label: 'Freehand Pen', icon: <Pencil className="w-5 h-5" />, shortcut: 'P' },
    { id: 'rect', label: 'Rectangle', icon: <Square className="w-5 h-5" />, shortcut: 'R' },
    { id: 'circle', label: 'Circle / Ellipse', icon: <Circle className="w-5 h-5" />, shortcut: 'C' },
    { id: 'frame', label: 'Frame / Artboard', icon: <Frame className="w-5 h-5" />, shortcut: 'F' },
    { id: 'arrow', label: 'Arrow (Snaps to Shapes)', icon: <ArrowUpRight className="w-5 h-5" />, shortcut: 'A' },
    { id: 'line', label: 'Straight Line', icon: <Minus className="w-5 h-5" />, shortcut: 'L' },
    { id: 'sticky', label: 'Sticky Note', icon: <StickyNote className="w-5 h-5" />, shortcut: 'S' },
    { id: 'text', label: 'Text', icon: <Type className="w-5 h-5" />, shortcut: 'T' },
    { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-5 h-5" />, shortcut: 'E' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 backdrop-blur-md border p-1.5 rounded-2xl shadow-2xl transition-all ${
        isDark
          ? 'bg-slate-900/90 border-slate-700/70 text-slate-300'
          : 'bg-white/90 border-slate-200 text-slate-700'
      }`}
    >
      {tools.map((tool) => {
        const isActive = currentTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tool.icon}
            <span
              className={`absolute -top-10 scale-0 group-hover:scale-100 transition-all text-xs font-medium px-2 py-1 rounded shadow-lg border pointer-events-none whitespace-nowrap ${
                isDark
                  ? 'bg-slate-900 text-slate-200 border-slate-700'
                  : 'bg-white text-slate-800 border-slate-200'
              }`}
            >
              {tool.label}{' '}
              <kbd
                className={`ml-1 text-[10px] px-1 py-0.5 rounded ${
                  isDark ? 'text-slate-400 bg-slate-800' : 'text-slate-500 bg-slate-100'
                }`}
              >
                {tool.shortcut}
              </kbd>
            </span>
          </button>
        );
      })}

      <div className={`w-[1px] h-6 mx-1 ${isDark ? 'bg-slate-700/60' : 'bg-slate-200'}`} />

      {/* Image Upload Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Upload Image"
        className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
          isDark
            ? 'text-slate-300 hover:text-white hover:bg-slate-800'
            : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <ImageIcon className="w-5 h-5" />
        <span
          className={`absolute -top-10 scale-0 group-hover:scale-100 transition-all text-xs font-medium px-2 py-1 rounded shadow-lg border pointer-events-none whitespace-nowrap ${
            isDark
              ? 'bg-slate-900 text-slate-200 border-slate-700'
              : 'bg-white text-slate-800 border-slate-200'
          }`}
        >
          Insert Image
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
