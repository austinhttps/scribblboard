import {
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Smile,
  MessageSquare,
  Lock,
  Unlock,
  Group,
  Ungroup,
} from 'lucide-react';
import {
  CanvasElement,
  ToolType,
  ToolProperties,
  StickyColor,
  ThemeMode,
} from '../../types/whiteboard';

interface PropertyBarProps {
  currentTool: ToolType;
  toolProperties: ToolProperties;
  theme: ThemeMode;
  onUpdateProperties: (props: Partial<ToolProperties>) => void;
  selectedElements: CanvasElement[];
  onUpdateSelected: (attrs: Partial<CanvasElement>) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onReorderSelected: (direction: 'up' | 'down') => void;
  onToggleLockSelected?: () => void;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
  onOpenEmojiPicker?: (elementId: string, position: { x: number; y: number }) => void;
  onOpenComments?: (elementId: string) => void;
  commentCount?: number;
}

const STROKE_COLORS = [
  '#ffffff',
  '#94a3b8',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#0f172a',
];

const FILL_COLORS = [
  'transparent',
  '#1e293b',
  '#7f1d1d',
  '#78350f',
  '#713f12',
  '#14532d',
  '#164e63',
  '#1e3a8a',
  '#312e81',
  '#581c87',
  '#831843',
  '#ffffff',
];

const STICKY_COLORS: { id: StickyColor; name: string; bg: string; border: string }[] = [
  { id: 'yellow', name: 'Yellow', bg: '#fef08a', border: '#facc15' },
  { id: 'pink', name: 'Pink', bg: '#fbcfe8', border: '#f472b6' },
  { id: 'blue', name: 'Blue', bg: '#bae6fd', border: '#38bdf8' },
  { id: 'green', name: 'Green', bg: '#bbf7d0', border: '#4ade80' },
  { id: 'purple', name: 'Purple', bg: '#e9d5ff', border: '#c084fc' },
  { id: 'orange', name: 'Orange', bg: '#fed7aa', border: '#fb923c' },
];

const STROKE_WIDTHS = [2, 4, 8, 14];
const FONT_SIZES = [14, 18, 24, 32, 48];

export const PropertyBar: React.FC<PropertyBarProps> = ({
  currentTool,
  toolProperties,
  theme,
  onUpdateProperties,
  selectedElements,
  onUpdateSelected,
  onDeleteSelected,
  onDuplicateSelected,
  onReorderSelected,
  onToggleLockSelected,
  onGroupSelected,
  onUngroupSelected,
  onOpenEmojiPicker,
  onOpenComments,
  commentCount = 0,
}) => {
  const isDark = theme === 'dark';
  const hasSelection = selectedElements.length > 0;
  const primarySelected = selectedElements[0];

  // Derived Selection Status
  const isAllLocked = hasSelection && selectedElements.every((el) => el.locked);
  const canGroup = selectedElements.length >= 2;
  const hasGroup = selectedElements.some((el) => !!el.groupId);

  // Determine what controls to show
  const showStickyColors = currentTool === 'sticky' || (hasSelection && primarySelected?.type === 'sticky');
  const showTextControls = currentTool === 'text' || (hasSelection && primarySelected?.type === 'text');
  const showShapeControls =
    ['rect', 'circle'].includes(currentTool) ||
    (hasSelection && ['rect', 'circle'].includes(primarySelected?.type || ''));
  const showLineControls =
    ['pen', 'arrow', 'line'].includes(currentTool) ||
    (hasSelection && ['pen', 'arrow', 'line'].includes(primarySelected?.type || ''));

  if (!hasSelection && currentTool === 'select') {
    return null;
  }

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-3 backdrop-blur-md border px-4 py-2 rounded-2xl shadow-xl transition-all ${
        isDark
          ? 'bg-slate-900/90 border-slate-700/70 text-slate-200'
          : 'bg-white/90 border-slate-200 text-slate-800'
      }`}
    >
      {/* Selection Action Controls */}
      {hasSelection && (
        <div className={`flex items-center gap-1.5 border-r pr-3 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
          {/* Lock / Unlock Toggle Button */}
          {onToggleLockSelected && (
            <button
              onClick={onToggleLockSelected}
              title={isAllLocked ? "Unlock Selection (Ctrl+L / Cmd+L)" : "Lock Selection (Ctrl+L / Cmd+L)"}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                isAllLocked
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                  : isDark
                  ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                  : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {isAllLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Unlock</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock</span>
                </>
              )}
            </button>
          )}

          {/* Group Button */}
          {canGroup && onGroupSelected && (
            <button
              onClick={onGroupSelected}
              disabled={isAllLocked}
              title={isAllLocked ? "Cannot group locked elements" : "Group Selection (Ctrl+G)"}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                isAllLocked
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : isDark
                  ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                  : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <Group className="w-3.5 h-3.5" />
              <span>Group</span>
            </button>
          )}

          {/* Ungroup Button */}
          {hasGroup && onUngroupSelected && (
            <button
              onClick={onUngroupSelected}
              disabled={isAllLocked}
              title={isAllLocked ? "Cannot ungroup locked elements" : "Ungroup Selection (Ctrl+Shift+G)"}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                isAllLocked
                  ? 'opacity-40 cursor-not-allowed text-slate-500'
                  : isDark
                  ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                  : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <Ungroup className="w-3.5 h-3.5" />
              <span>Ungroup</span>
            </button>
          )}

          {/* Duplicate Button (disabled when isAllLocked) */}
          <button
            onClick={onDuplicateSelected}
            disabled={isAllLocked}
            title={isAllLocked ? "Cannot duplicate locked elements" : "Duplicate (Ctrl+D)"}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : isDark
                ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>

          {/* Bring Forward (disabled when isAllLocked) */}
          <button
            onClick={() => onReorderSelected('up')}
            disabled={isAllLocked}
            title={isAllLocked ? "Selection is locked" : "Bring Forward"}
            className={`p-1 rounded-lg transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : isDark
                ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          {/* Send Backward (disabled when isAllLocked) */}
          <button
            onClick={() => onReorderSelected('down')}
            disabled={isAllLocked}
            title={isAllLocked ? "Selection is locked" : "Send Backward"}
            className={`p-1 rounded-lg transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : isDark
                ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Emoji Reaction button */}
          {primarySelected && onOpenEmojiPicker && (
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenEmojiPicker(primarySelected.id, { x: rect.left, y: rect.bottom + 6 });
              }}
              title="Add Emoji Reaction"
              className={`p-1 text-amber-400 hover:text-amber-300 rounded-lg transition-all ${
                isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Comment Thread button */}
          {primarySelected && onOpenComments && (
            <button
              onClick={() => onOpenComments(primarySelected.id)}
              title="Open Comments Thread"
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-all ${
                commentCount > 0
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : isDark
                  ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                  : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {commentCount > 0 && <span className="text-[10px] font-bold">{commentCount}</span>}
            </button>
          )}

          {/* Delete (disabled when isAllLocked) */}
          <button
            onClick={onDeleteSelected}
            disabled={isAllLocked}
            title={isAllLocked ? "Cannot delete locked elements" : "Delete (Del)"}
            className={`p-1 rounded-lg transition-all ${
              isAllLocked
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : isDark
                ? 'text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50'
                : 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sticky Note Colors */}
      {showStickyColors && (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Color:</span>
          {STICKY_COLORS.map((c) => {
            const isSelected = hasSelection
              ? primarySelected?.type === 'sticky' && primarySelected.color === c.id
              : toolProperties.stickyColor === c.id;

            return (
              <button
                key={c.id}
                onClick={() => {
                  onUpdateProperties({ stickyColor: c.id });
                  if (hasSelection) onUpdateSelected({ color: c.id } as any);
                }}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${
                  isSelected ? 'scale-125 border-indigo-500 shadow-md ring-2 ring-indigo-400/40' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c.bg, borderColor: isSelected ? '#6366f1' : c.border }}
                title={c.name}
              />
            );
          })}
        </div>
      )}

      {/* Stroke Color Palette */}
      {(showLineControls || showShapeControls || showTextControls) && (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {showTextControls ? 'Text Color:' : 'Stroke:'}
          </span>
          <div className="flex items-center gap-1">
            {STROKE_COLORS.map((color) => {
              const activeColor = hasSelection
                ? (primarySelected as any)?.stroke || (primarySelected as any)?.color || (primarySelected as any)?.fill
                : toolProperties.strokeColor;
              const isSelected = activeColor === color;

              return (
                <button
                  key={color}
                  onClick={() => {
                    onUpdateProperties({ strokeColor: color });
                    if (hasSelection) {
                      if (primarySelected.type === 'pen' || primarySelected.type === 'arrow' || primarySelected.type === 'line') {
                        onUpdateSelected({ color } as any);
                      } else if (primarySelected.type === 'text') {
                        onUpdateSelected({ fill: color } as any);
                      } else {
                        onUpdateSelected({ stroke: color } as any);
                      }
                    }
                  }}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    isSelected
                      ? 'scale-125 border-white ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900'
                      : isDark
                      ? 'border-slate-600 hover:scale-110'
                      : 'border-slate-300 hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Fill Color for Shapes */}
      {showShapeControls && (
        <div className={`flex items-center gap-1.5 border-l pl-3 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fill:</span>
          <div className="flex items-center gap-1">
            {FILL_COLORS.map((fill) => {
              const activeFill = hasSelection
                ? (primarySelected as any)?.fill
                : toolProperties.fillColor;
              const isSelected = activeFill === fill;

              return (
                <button
                  key={fill}
                  onClick={() => {
                    onUpdateProperties({ fillColor: fill });
                    if (hasSelection) onUpdateSelected({ fill } as any);
                  }}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    isSelected
                      ? 'scale-125 border-white ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-900'
                      : isDark
                      ? 'border-slate-600 hover:scale-110'
                      : 'border-slate-300 hover:scale-110'
                  }`}
                  style={{
                    backgroundColor: fill === 'transparent' ? (isDark ? '#334155' : '#e2e8f0') : fill,
                    backgroundImage: fill === 'transparent' ? 'linear-gradient(45deg, transparent 40%, red 45%, red 55%, transparent 60%)' : 'none',
                  }}
                  title={fill === 'transparent' ? 'Transparent' : fill}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Stroke Width Selector */}
      {(showLineControls || showShapeControls) && (
        <div className={`flex items-center gap-1.5 border-l pl-3 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Width:</span>
          <div className={`flex items-center gap-1 p-0.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {STROKE_WIDTHS.map((width) => {
              const activeWidth = hasSelection
                ? (primarySelected as any)?.strokeWidth || 2
                : toolProperties.strokeWidth;
              const isSelected = activeWidth === width;

              return (
                <button
                  key={width}
                  onClick={() => {
                    onUpdateProperties({ strokeWidth: width });
                    if (hasSelection) onUpdateSelected({ strokeWidth: width } as any);
                  }}
                  className={`px-2 py-1 text-xs rounded font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {width}px
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Font Size Selector */}
      {showTextControls && (
        <div className={`flex items-center gap-1.5 border-l pl-3 ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Size:</span>
          <div className={`flex items-center gap-1 p-0.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {FONT_SIZES.map((size) => {
              const activeSize = hasSelection
                ? (primarySelected as any)?.fontSize || 20
                : toolProperties.fontSize;
              const isSelected = activeSize === size;

              return (
                <button
                  key={size}
                  onClick={() => {
                    onUpdateProperties({ fontSize: size });
                    if (hasSelection) onUpdateSelected({ fontSize: size } as any);
                  }}
                  className={`px-2 py-1 text-xs rounded font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
