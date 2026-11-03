import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  Layers,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  StickyNote,
  Type,
  Square,
  Circle,
  ArrowUpRight,
  Minus,
  Image as ImageIcon,
  ZoomIn,
  CheckSquare,
  Download,
  Edit3,
  MessageSquare,
  Lock,
  Unlock,
  Group,
  Ungroup,
} from 'lucide-react';
import { CanvasElement, StickyColor } from '../../types/whiteboard';

export interface ContextMenuProps {
  x: number;
  y: number;
  canvasPoint: { x: number; y: number };
  targetElement: CanvasElement | null;
  selectedElements: CanvasElement[];
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onToggleLock?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onEditItem?: () => void;
  onChangeColor?: (color: string) => void;
  onAddSticky: (point: { x: number; y: number }, color?: StickyColor) => void;
  onAddText: (point: { x: number; y: number }) => void;
  onAddShape: (type: 'rect' | 'circle' | 'arrow' | 'line', point: { x: number; y: number }) => void;
  onSelectAll: () => void;
  onResetZoom: () => void;
  onExportViewport: () => void;
  onUploadImage: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: (point: { x: number; y: number }) => void;
  hasClipboard: boolean;
  onToggleReaction?: (elementId: string, emoji: string) => void;
  onOpenComments?: (elementId: string) => void;
}

const STICKY_QUICK_COLORS: { id: StickyColor; bg: string }[] = [
  { id: 'yellow', bg: '#fef08a' },
  { id: 'pink', bg: '#fbcfe8' },
  { id: 'blue', bg: '#bae6fd' },
  { id: 'green', bg: '#bbf7d0' },
  { id: 'purple', bg: '#e9d5ff' },
  { id: 'orange', bg: '#fed7aa' },
];

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  canvasPoint,
  targetElement,
  selectedElements,
  onClose,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  onBringForward,
  onSendBackward,
  onToggleLock,
  onGroup,
  onUngroup,
  onEditItem,
  onChangeColor,
  onAddSticky,
  onAddText,
  onAddShape,
  onSelectAll,
  onResetZoom,
  onExportViewport,
  onUploadImage,
  onCopy,
  onCut,
  onPaste,
  hasClipboard,
  onToggleReaction,
  onOpenComments,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ top: number; left: number }>({ top: y, left: x });

  // Determine active elements target for context operations
  const targetItems = selectedElements.length > 0
    ? selectedElements
    : (targetElement ? [targetElement] : []);
  const isAllLocked = targetItems.length > 0 && targetItems.every((el) => el.locked);
  const canGroup = targetItems.length >= 2;
  const hasGroup = targetItems.some((el) => !!el.groupId);

  // Auto-fit within window boundaries
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const padding = 12;
      let left = x;
      let top = y;

      if (left + rect.width > window.innerWidth - padding) {
        left = window.innerWidth - rect.width - padding;
      }
      if (left < padding) {
        left = padding;
      }

      if (top + rect.height > window.innerHeight - padding) {
        top = window.innerHeight - rect.height - padding;
      }
      if (top < padding) {
        top = padding;
      }

      setAdjustedPos({ top, left });
    }
  }, [x, y]);

  // Close on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const hasTarget = targetElement !== null || selectedElements.length > 0;
  const isEditableText = targetElement?.type === 'sticky' || targetElement?.type === 'text';

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedPos.top}px`, left: `${adjustedPos.left}px` }}
      className="fixed z-50 min-w-[220px] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 text-slate-200 text-xs font-medium animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {hasTarget ? (
        /* Element Selected Menu */
        <div className="flex flex-col gap-0.5">
          {/* Header indicator */}
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1">
            <span>
              {selectedElements.length > 1
                ? `${selectedElements.length} Objects Selected`
                : `${targetElement?.type?.toUpperCase() || 'Object'} Selected`}
            </span>
          </div>

          {/* Quick Reaction Strip */}
          {targetElement && onToggleReaction && (
            <div className="px-2 py-1 flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1">
              {['👍', '❤️', '🔥', '🚀', '🎉', '👀', '💡'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onToggleReaction(targetElement.id, emoji);
                    onClose();
                  }}
                  className="w-6 h-6 flex items-center justify-center text-sm rounded-lg hover:bg-slate-800 hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Comments action */}
          {targetElement && onOpenComments && (
            <button
              onClick={() => {
                onOpenComments(targetElement.id);
                onClose();
              }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Comments & Discussion
              </span>
            </button>
          )}

          {/* Edit in place if Text/Sticky */}
          {isEditableText && onEditItem && (
            <button
              onClick={() => {
                onEditItem();
                onClose();
              }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-indigo-600 hover:text-white transition-all group"
            >
              <span className="flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5 text-indigo-400 group-hover:text-white" /> Edit Content
              </span>
              <kbd className="text-[10px] text-slate-400 group-hover:text-white bg-slate-800/80 group-hover:bg-indigo-700 px-1.5 py-0.5 rounded">
                Dbl Click
              </kbd>
            </button>
          )}

          {/* Quick Color Swatches for Sticky Notes */}
          {targetElement?.type === 'sticky' && onChangeColor && (
            <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-800/80 my-0.5">
              <span className="text-[11px] text-slate-400">Note Color:</span>
              <div className="flex items-center gap-1">
                {STICKY_QUICK_COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onChangeColor(c.id);
                      onClose();
                    }}
                    className="w-4 h-4 rounded-full border border-slate-600 hover:scale-125 transition-transform"
                    style={{ backgroundColor: c.bg }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grouping Actions */}
          {canGroup && onGroup && !isAllLocked && (
            <button
              onClick={() => {
                onGroup();
                onClose();
              }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Group className="w-3.5 h-3.5 text-indigo-400" /> Group Selection
              </span>
              <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+G</kbd>
            </button>
          )}

          {hasGroup && onUngroup && !isAllLocked && (
            <button
              onClick={() => {
                onUngroup();
                onClose();
              }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Ungroup className="w-3.5 h-3.5 text-indigo-400" /> Ungroup Selection
              </span>
              <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+Shift+G</kbd>
            </button>
          )}

          {/* Lock / Unlock Action */}
          {onToggleLock && (
            <button
              onClick={() => {
                onToggleLock();
                onClose();
              }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2">
                {isAllLocked ? (
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{isAllLocked ? 'Unlock Selection' : 'Lock Selection'}</span>
              </span>
              <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+L</kbd>
            </button>
          )}

          <div className="w-full h-[1px] bg-slate-800 my-1" />

          {/* Clipboard Actions */}
          <button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-slate-400" /> Copy
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+C</kbd>
          </button>

          <button
            onClick={() => {
              if (!isAllLocked) {
                onCut();
                onClose();
              }
            }}
            disabled={isAllLocked}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-slate-400" /> Cut
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+X</kbd>
          </button>

          <button
            onClick={() => {
              if (!isAllLocked) {
                onDuplicate();
                onClose();
              }
            }}
            disabled={isAllLocked}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Duplicate
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+D</kbd>
          </button>

          <div className="w-full h-[1px] bg-slate-800 my-1" />

          {/* Layer Order */}
          <div className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Layer Order
          </div>

          <button
            onClick={() => {
              if (!isAllLocked) {
                onBringToFront();
                onClose();
              }
            }}
            disabled={isAllLocked}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <ArrowUpToLine className="w-3.5 h-3.5 text-slate-400" /> Bring to Front
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+]</kbd>
          </button>

          <button
            onClick={() => {
              if (!isAllLocked) {
                onBringForward();
                onClose();
              }
            }}
            disabled={isAllLocked}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5 text-slate-400" /> Bring Forward
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">]</kbd>
          </button>

          <button
            onClick={() => {
              if (!isAllLocked) {
                onSendBackward();
                onClose();
              }
            }}
            disabled={isAllLocked}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5 text-slate-400" /> Send Backward
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">[</kbd>
          </button>

          <button
            onClick={() => {
              if (!isAllLocked) {
                onSendToBack();
                onClose();
              }
            }}
            disabled={isAllLocked}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <ArrowDownToLine className="w-3.5 h-3.5 text-slate-400" /> Send to Back
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+[</kbd>
          </button>

          <div className="w-full h-[1px] bg-slate-800 my-1" />

          {/* Delete */}
          <button
            onClick={() => {
              if (!isAllLocked) {
                onDelete();
                onClose();
              }
            }}
            disabled={isAllLocked}
            className={`flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'hover:bg-red-950/50 text-red-400 hover:text-red-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </span>
            <kbd className="text-[10px] text-red-400/80 bg-red-950/60 px-1.5 py-0.5 rounded">Del</kbd>
          </button>
        </div>
      ) : (
        /* Empty Canvas Context Menu */
        <div className="flex flex-col gap-0.5">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
            Quick Insert
          </div>

          {/* Paste */}
          {hasClipboard && (
            <button
              onClick={() => {
                onPaste(canvasPoint);
                onClose();
              }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-slate-200"
            >
              <span className="flex items-center gap-2">
                <ClipboardPaste className="w-3.5 h-3.5" /> Paste Here
              </span>
              <kbd className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+V</kbd>
            </button>
          )}

          {/* Quick Insert Items */}
          <button
            onClick={() => {
              onAddSticky(canvasPoint);
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <StickyNote className="w-3.5 h-3.5 text-amber-400" /> Sticky Note
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">S</kbd>
          </button>

          <button
            onClick={() => {
              onAddText(canvasPoint);
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-blue-400" /> Text Box
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">T</kbd>
          </button>

          <button
            onClick={() => {
              onAddShape('rect', canvasPoint);
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Square className="w-3.5 h-3.5 text-indigo-400" /> Rectangle
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">R</kbd>
          </button>

          <button
            onClick={() => {
              onAddShape('circle', canvasPoint);
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Circle className="w-3.5 h-3.5 text-emerald-400" /> Circle
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">C</kbd>
          </button>

          <button
            onClick={() => {
              onAddShape('arrow', canvasPoint);
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" /> Arrow
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">A</kbd>
          </button>

          <button
            onClick={() => {
              onAddShape('line', canvasPoint);
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Minus className="w-3.5 h-3.5 text-cyan-400" /> Straight Line
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">L</kbd>
          </button>

          <button
            onClick={() => {
              onUploadImage();
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-pink-400" /> Insert Image
            </span>
          </button>

          <div className="w-full h-[1px] bg-slate-800 my-1" />

          {/* Canvas Utilities */}
          <button
            onClick={() => {
              onSelectAll();
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" /> Select All
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Ctrl+A</kbd>
          </button>

          <button
            onClick={() => {
              onResetZoom();
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <ZoomIn className="w-3.5 h-3.5 text-slate-400" /> Reset Zoom (100%)
            </span>
          </button>

          <button
            onClick={() => {
              onExportViewport();
              onClose();
            }}
            className="flex items-center justify-between w-full px-2.5 py-1.5 text-left rounded-xl hover:bg-slate-800 transition-all text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-slate-400" /> Export Viewport
            </span>
            <kbd className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">PNG</kbd>
          </button>
        </div>
      )}
    </div>
  );
};
