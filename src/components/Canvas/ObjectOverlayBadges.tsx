import React from 'react';
import { MessageSquare, Plus, Lock } from 'lucide-react';
import { CanvasElement, CommentThread, ThemeMode } from '../../types/whiteboard';

interface ObjectOverlayBadgesProps {
  elements: CanvasElement[];
  comments: CommentThread[];
  stageScale: number;
  stagePos: { x: number; y: number };
  localUserId: string;
  selectedIds: string[];
  onToggleReaction: (elementId: string, emoji: string) => void;
  onOpenEmojiPicker: (elementId: string, position: { x: number; y: number }) => void;
  onOpenComments: (elementId: string) => void;
  onUnlockElement?: (elementId: string) => void;
  theme: ThemeMode;
}

export const ObjectOverlayBadges: React.FC<ObjectOverlayBadgesProps> = ({
  elements,
  comments,
  stageScale,
  stagePos,
  localUserId,
  selectedIds,
  onToggleReaction,
  onOpenEmojiPicker,
  onOpenComments,
  onUnlockElement,
  theme,
}) => {
  const isDark = theme === 'dark';

  // Group comments by elementId
  const commentsByElement = React.useMemo(() => {
    const map = new Map<string, CommentThread[]>();
    comments.forEach((c) => {
      const list = map.get(c.elementId) || [];
      list.push(c);
      map.set(c.elementId, list);
    });
    return map;
  }, [comments]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {elements.map((el) => {
        // Calculate screen bounding box
        let minX = el.x;
        let minY = el.y;
        let width = (el as any).width || 120;
        let height = (el as any).height || 80;

        if (el.type === 'circle') {
          minX = el.x - (el.radiusX || 30);
          minY = el.y - (el.radiusY || 30);
          width = (el.radiusX || 30) * 2;
          height = (el.radiusY || 30) * 2;
        } else if (el.type === 'pen' || el.type === 'arrow' || el.type === 'line') {
          const pts = el.points || [];
          if (pts.length >= 4) {
            let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
            for (let i = 0; i < pts.length; i += 2) {
              const px = pts[i] + (el.x || 0);
              const py = pts[i + 1] + (el.y || 0);
              pMinX = Math.min(pMinX, px);
              pMinY = Math.min(pMinY, py);
              pMaxX = Math.max(pMaxX, px);
              pMaxY = Math.max(pMaxY, py);
            }
            minX = pMinX;
            minY = pMinY;
            width = pMaxX - pMinX;
            height = pMaxY - pMinY;
          }
        }

        const screenX = minX * stageScale + stagePos.x;
        const screenY = minY * stageScale + stagePos.y;
        const screenWidth = width * stageScale;
        const screenHeight = height * stageScale;

        // Frustum Culling: Skip elements completely outside viewport
        const padding = 60;
        if (
          screenX + screenWidth < -padding ||
          screenX > window.innerWidth + padding ||
          screenY + screenHeight < -padding ||
          screenY > window.innerHeight + padding
        ) {
          return null;
        }

        // Group reactions for this element
        const rawReactions = el.reactions || [];
        const reactionGroups: { emoji: string; count: number; hasReacted: boolean; userNames: string[] }[] = [];
        rawReactions.forEach((r) => {
          let group = reactionGroups.find((g) => g.emoji === r.emoji);
          if (!group) {
            group = { emoji: r.emoji, count: 0, hasReacted: false, userNames: [] };
            reactionGroups.push(group);
          }
          group.count += 1;
          if (r.userId === localUserId) group.hasReacted = true;
          if (r.userName && !group.userNames.includes(r.userName)) group.userNames.push(r.userName);
        });

        const isLocked = !!el.locked;
        const elComments = commentsByElement.get(el.id) || [];
        const hasComments = elComments.length > 0;
        const isSelected = selectedIds.includes(el.id);
        const showReactions = reactionGroups.length > 0 || isSelected;

        // Don't render badges if offscreen or nothing to show
        if (!showReactions && !hasComments && !isLocked) return null;

        return (
          <React.Fragment key={el.id}>
            {/* Lock Badge at Top-Left of Object */}
            {isLocked && (
              <div
                className="absolute pointer-events-auto transition-transform hover:scale-110"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY - 26}px`,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnlockElement?.(el.id);
                  }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow-md border text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold shadow-amber-500/30'
                      : isDark
                      ? 'bg-slate-900/90 text-amber-400 border-amber-500/40 hover:bg-amber-500 hover:text-slate-950'
                      : 'bg-white/95 text-amber-600 border-amber-400/60 hover:bg-amber-500 hover:text-slate-950'
                  }`}
                  title="Locked element — Click to unlock (Ctrl+L)"
                >
                  <Lock className="w-3 h-3" />
                  <span>{isSelected ? 'Unlock' : 'Locked'}</span>
                </button>
              </div>
            )}

            {/* 1. Comment Badge at Top-Right of Object */}
            {(hasComments || isSelected) && (
              <div
                className="absolute pointer-events-auto transition-transform hover:scale-110"
                style={{
                  left: `${screenX + screenWidth - 12}px`,
                  top: `${screenY - 14}px`,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenComments(el.id);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full shadow-lg border text-xs font-semibold transition-all ${
                    hasComments
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/40 shadow-indigo-600/30'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                  title={hasComments ? `${elComments.length} comment(s) - Click to view` : 'Add comment'}
                >
                  <MessageSquare className="w-3 h-3" />
                  {hasComments && <span>{elComments.length}</span>}
                </button>
              </div>
            )}

            {/* 2. Reaction Chips Bar at Bottom of Object */}
            {reactionGroups.length > 0 && (
              <div
                className="absolute pointer-events-auto flex items-center gap-1 flex-wrap"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY + screenHeight + 6}px`,
                }}
              >
                {reactionGroups.map((g) => (
                  <button
                    key={g.emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleReaction(el.id, g.emoji);
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shadow-md transition-transform hover:scale-110 ${
                      g.hasReacted
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : isDark
                        ? 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:bg-slate-800'
                        : 'bg-white/95 border-slate-300 text-slate-800 hover:bg-slate-100'
                    }`}
                    title={g.userNames.length > 0 ? g.userNames.join(', ') : undefined}
                  >
                    <span>{g.emoji}</span>
                    <span className="font-semibold text-[10px]">{g.count}</span>
                  </button>
                ))}

                {/* Add reaction plus button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    onOpenEmojiPicker(el.id, { x: rect.left, y: rect.bottom + 4 });
                  }}
                  className={`w-5 h-5 flex items-center justify-center rounded-full border shadow-md transition-all hover:scale-110 ${
                    isDark
                      ? 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'bg-white/95 border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Add reaction"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
