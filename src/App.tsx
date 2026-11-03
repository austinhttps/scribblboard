import { useState, useRef, useEffect, useCallback } from 'react';
import Konva from 'konva';
import { useWhiteboard } from './hooks/useWhiteboard';
import { Whiteboard } from './components/Canvas/Whiteboard';
import { MainToolbar } from './components/Toolbar/MainToolbar';
import { PropertyBar } from './components/Toolbar/PropertyBar';
import { Header } from './components/Header/Header';
import { ShortcutsModal } from './components/Modals/ShortcutsModal';
import { EmojiPickerPopover } from './components/Modals/EmojiPickerPopover';
import { CommentThreadModal } from './components/Modals/CommentThreadModal';
import { ToolType, ToolProperties, GridType, CanvasElement, ThemeMode } from './types/whiteboard';

/**
 * scribblboard Root Application Component
 * 
 * Manages active canvas tools, contextual property bar options,
 * selection states, clipboard, peer awareness, theme mode, and binds UI interactions to the Yjs CRDT store.
 */
export function App() {
  const {
    boardId,
    boardName,
    setBoardName,
    elements,
    comments,
    isLoaded,
    isConnected,
    collaborators,
    localUser,
    canUndo,
    canRedo,
    createNewBoard,
    setElement,
    setBatchElements,
    deleteElement,
    deleteElements,
    toggleReaction,
    addComment,
    addReply,
    deleteComment,
    toggleResolveComment,
    clearAll,
    undo,
    redo,
    updateCursor,
    updateUserName,
    isBoardInitialized,
    setBoardInitialized,
    isBoardCreator,
    getNextZIndex,
  } = useWhiteboard();

  // Client-side theme mode (dark / light) persisted in localStorage
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('collab_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('collab_theme', next);
      return next;
    });
  }, []);

  // Synchronize document HTML class for Tailwind dark mode
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gridType, setGridType] = useState<GridType>('dots');
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  const [clipboard, setClipboard] = useState<CanvasElement[]>([]);
  const [activeCommentElementId, setActiveCommentElementId] = useState<string | null>(null);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<{ elementId: string; position: { x: number; y: number } } | null>(null);

  const [toolProperties, setToolProperties] = useState<ToolProperties>({
    strokeColor: '#6366f1',
    fillColor: 'transparent',
    strokeWidth: 4,
    fontSize: 20,
    stickyColor: 'yellow',
  });

  const stageRef = useRef<Konva.Stage | null>(null);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  // Setup initial welcome content ONLY on brand new uninitialized boards
  useEffect(() => {
    if (isLoaded && !isBoardInitialized() && elements.length === 0 && isBoardCreator()) {
      const initialElements: CanvasElement[] = [
        {
          id: 'welcome-sticky',
          type: 'sticky',
          x: window.innerWidth / 2 - 180,
          y: window.innerHeight / 2 - 140,
          width: 220,
          height: 180,
          text: '✨ Live Collaborative Board!\n\n• Share URL to collaborate\n• See live peer cursors\n• Space+Drag to Pan\n• Right-click for Quick Menu',
          color: 'yellow',
          fontSize: 17,
          zIndex: 1,
          updatedAt: Date.now(),
        },
        {
          id: 'welcome-shape',
          type: 'rect',
          x: window.innerWidth / 2 + 80,
          y: window.innerHeight / 2 - 140,
          width: 140,
          height: 100,
          fill: '#312e81',
          stroke: '#818cf8',
          strokeWidth: 3,
          cornerRadius: 12,
          zIndex: 2,
          updatedAt: Date.now(),
        },
        {
          id: 'welcome-arrow',
          type: 'arrow',
          points: [
            window.innerWidth / 2 + 45,
            window.innerHeight / 2 - 50,
            window.innerWidth / 2 + 80,
            window.innerHeight / 2 - 70,
          ],
          color: '#a5b4fc',
          strokeWidth: 3,
          x: 0,
          y: 0,
          zIndex: 3,
          updatedAt: Date.now(),
        },
      ];
      setBatchElements(initialElements);
      setBoardInitialized(true);
    }
  }, [isLoaded, elements.length, isBoardInitialized, setBoardInitialized, setBatchElements, isBoardCreator]);

  // Selected elements list
  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));

  // Toggle lock status on selected elements (Ctrl+L / Cmd+L)
  const handleToggleLock = useCallback(() => {
    if (selectedElements.length === 0) return;

    // If any selected item is unlocked, lock all; otherwise unlock all
    const anyUnlocked = selectedElements.some((el) => !el.locked);
    const targetLocked = anyUnlocked;

    const updatedElements: CanvasElement[] = selectedElements.map((el) => {
      const clone = { ...el, updatedAt: Date.now() };
      if (targetLocked) {
        clone.locked = true;
      } else {
        delete clone.locked;
      }
      return clone as CanvasElement;
    });

    setBatchElements(updatedElements);
  }, [selectedElements, setBatchElements]);

  // Group selected elements into a single logical group (Ctrl+G / Cmd+G)
  const handleGroupSelected = useCallback(() => {
    if (selectedElements.length < 2) return;

    const newGroupId = crypto.randomUUID();
    const updatedElements: CanvasElement[] = selectedElements.map((el) => ({
      ...el,
      groupId: newGroupId,
      updatedAt: Date.now(),
    } as CanvasElement));

    setBatchElements(updatedElements);
  }, [selectedElements, setBatchElements]);

  // Ungroup selected elements (Ctrl+Shift+G / Cmd+Shift+G)
  const handleUngroupSelected = useCallback(() => {
    if (selectedElements.length === 0) return;

    // Collect all group IDs present among selected items
    const groupIdsToClear = new Set(
      selectedElements
        .map((el) => el.groupId)
        .filter((gid): gid is string => Boolean(gid))
    );

    if (groupIdsToClear.size === 0) return;

    // Clear groupId for all elements in the board belonging to these groups
    const elementsToUpdate = elements
      .filter((el) => el.groupId && groupIdsToClear.has(el.groupId))
      .map((el) => {
        const clone = { ...el, updatedAt: Date.now() };
        delete clone.groupId;
        return clone as CanvasElement;
      });

    if (elementsToUpdate.length > 0) {
      setBatchElements(elementsToUpdate);
    }
  }, [elements, selectedElements, setBatchElements]);

  // Copy elements to clipboard
  const handleCopy = useCallback(() => {
    if (selectedElements.length > 0) {
      setClipboard(selectedElements);
    }
  }, [selectedElements]);

  // Cut elements
  const handleCut = useCallback(() => {
    if (selectedElements.length > 0) {
      setClipboard(selectedElements);
      deleteElements(selectedIds);
      setSelectedIds([]);
    }
  }, [selectedElements, selectedIds, deleteElements]);

  // Paste elements
  const handlePaste = useCallback(
    (point?: { x: number; y: number }) => {
      if (clipboard.length === 0) return;

      const newElements: CanvasElement[] = [];
      const newIds: string[] = [];

      // Calculate bounding center of copied elements
      let minX = Infinity, minY = Infinity;
      clipboard.forEach((el) => {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
      });

      clipboard.forEach((el) => {
        const newId = crypto.randomUUID();
        newIds.push(newId);

        let targetX = el.x + 25;
        let targetY = el.y + 25;

        if (point) {
          const offsetX = el.x - minX;
          const offsetY = el.y - minY;
          targetX = point.x + offsetX;
          targetY = point.y + offsetY;
        }

        newElements.push({
          ...el,
          id: newId,
          x: targetX,
          y: targetY,
          zIndex: getNextZIndex(),
          updatedAt: Date.now(),
        });
      });

      newElements.forEach((item) => setElement(item));
      setSelectedIds(newIds);
    },
    [clipboard, getNextZIndex, setElement]
  );

  // Global hotkeys for tools, locking, grouping, clipboard & actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against typing in input fields, textareas, or contenteditable elements
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
          activeEl.isContentEditable ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // Delete / Backspace key (strictly delete only unlocked elements)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const unlockedSelected = selectedElements.filter((el) => !el.locked);
        if (unlockedSelected.length > 0) {
          const unlockedIds = unlockedSelected.map((el) => el.id);
          deleteElements(unlockedIds);
          setSelectedIds((prev) => prev.filter((id) => !unlockedIds.includes(id)));
        }
        return;
      }

      // Select All (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
        setCurrentTool('select');
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Copy / Cut / Paste
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedIds.length > 0) {
        e.preventDefault();
        handleCopy();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedIds.length > 0) {
        e.preventDefault();
        handleCut();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
          e.preventDefault();
          handlePaste();
          return;
        }
      }

      // Object Locking (Ctrl+L / Cmd+L)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          handleToggleLock();
        }
        return;
      }

      // Grouping (Ctrl+G / Cmd+G) and Ungrouping (Ctrl+Shift+G / Cmd+Shift+G)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          handleUngroupSelected();
        } else if (selectedIds.length >= 2) {
          handleGroupSelected();
        }
        return;
      }

      // Tool selection shortcuts (ONLY when no modifier keys are held)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            setCurrentTool('select');
            break;
          case 'h':
            setCurrentTool('pan');
            break;
          case 'p':
            setCurrentTool('pen');
            break;
          case 'r':
            setCurrentTool('rect');
            break;
          case 'c':
            setCurrentTool('circle');
            break;
          case 'a':
            setCurrentTool('arrow');
            break;
          case 'l':
            setCurrentTool('line');
            break;
          case 's':
            setCurrentTool('sticky');
            break;
          case 't':
            setCurrentTool('text');
            break;
          case 'e':
            setCurrentTool('eraser');
            break;
          case '?':
            setIsShortcutsOpen((prev) => !prev);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    selectedIds,
    selectedElements,
    elements,
    clipboard,
    handleCopy,
    handleCut,
    handlePaste,
    handleToggleLock,
    handleGroupSelected,
    handleUngroupSelected,
    deleteElements,
  ]);

  // Handle image upload from file picker
  const handleUploadImage = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const src = loadEvent.target?.result as string;
        const img = new window.Image();
        img.src = src;
        img.onload = () => {
          const stage = stageRef.current;
          const stageX = stage ? (-stage.x() + stage.width() / 2) / stage.scaleX() : 200;
          const stageY = stage ? (-stage.y() + stage.height() / 2) / stage.scaleY() : 200;

          const maxDim = 320;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = width * ratio;
            height = height * ratio;
          }

          const newEl: CanvasElement = {
            id: crypto.randomUUID(),
            type: 'image',
            src,
            x: stageX - width / 2,
            y: stageY - height / 2,
            width,
            height,
            zIndex: getNextZIndex(),
            updatedAt: Date.now(),
          };

          setElement(newEl);
          setSelectedIds([newEl.id]);
          setCurrentTool('select');
        };
      };
      reader.readAsDataURL(file);
    },
    [getNextZIndex, setElement]
  );

  // Update selected element attributes
  const handleUpdateSelected = useCallback(
    (attrs: Partial<CanvasElement>) => {
      selectedElements.forEach((el) => {
        setElement({
          ...el,
          ...attrs,
          updatedAt: Date.now(),
        } as CanvasElement);
      });
    },
    [selectedElements, setElement]
  );

  // Delete selected (only unlocked elements)
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      const unlockedSelected = selectedElements.filter((el) => !el.locked);
      if (unlockedSelected.length > 0) {
        const unlockedIds = unlockedSelected.map((el) => el.id);
        deleteElements(unlockedIds);
        setSelectedIds((prev) => prev.filter((id) => !unlockedIds.includes(id)));
      }
    }
  }, [selectedIds, selectedElements, deleteElements]);

  // Duplicate selected
  const handleDuplicateSelected = useCallback(() => {
    const duplicates: CanvasElement[] = [];
    const newIds: string[] = [];

    selectedElements.forEach((el) => {
      const newId = crypto.randomUUID();
      newIds.push(newId);
      duplicates.push({
        ...el,
        id: newId,
        x: el.x + 30,
        y: el.y + 30,
        zIndex: getNextZIndex(),
        updatedAt: Date.now(),
      });
    });

    duplicates.forEach((dup) => setElement(dup));
    setSelectedIds(newIds);
  }, [selectedElements, getNextZIndex, setElement]);

  // Reorder layer
  const handleReorderSelected = useCallback(
    (direction: 'up' | 'down') => {
      selectedElements.forEach((el) => {
        const currentZ = el.zIndex ?? 0;
        const newZ = direction === 'up' ? currentZ + 2 : Math.max(0, currentZ - 2);
        setElement({
          ...el,
          zIndex: newZ,
          updatedAt: Date.now(),
        });
      });
    },
    [selectedElements, setElement]
  );

  const isDark = theme === 'dark';

  const selectedCommentCount = selectedElements.length === 1
    ? comments.filter((c) => c.elementId === selectedElements[0].id).length
    : 0;
  const activeCommentElement = elements.find((el) => el.id === activeCommentElementId) || null;

  return (
    <div className={`relative w-screen h-screen overflow-hidden font-sans transition-colors ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <Header
        boardId={boardId}
        boardName={boardName}
        onUpdateBoardName={setBoardName}
        isLoaded={isLoaded}
        isConnected={isConnected}
        collaborators={collaborators}
        localUser={localUser}
        onUpdateUserName={updateUserName}
        theme={theme}
        onToggleTheme={toggleTheme}
        canUndo={canUndo}
        canRedo={canRedo}
        gridType={gridType}
        onSetGridType={setGridType}
        onUndo={undo}
        onRedo={redo}
        onNewBoard={createNewBoard}
        onClearAll={clearAll}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        stageRef={stageRef}
        elements={elements}
        onImportElements={(imported) => setBatchElements(imported)}
      />

      {/* Property Bar for Contextual Styling */}
      <PropertyBar
        currentTool={currentTool}
        toolProperties={toolProperties}
        theme={theme}
        onUpdateProperties={(props) => setToolProperties((prev) => ({ ...prev, ...props }))}
        selectedElements={selectedElements}
        onUpdateSelected={handleUpdateSelected}
        onDeleteSelected={handleDeleteSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onReorderSelected={handleReorderSelected}
        onToggleLockSelected={handleToggleLock}
        onGroupSelected={handleGroupSelected}
        onUngroupSelected={handleUngroupSelected}
        onOpenEmojiPicker={(elementId, position) => setActiveEmojiPicker({ elementId, position })}
        onOpenComments={(elementId) => setActiveCommentElementId(elementId)}
        commentCount={selectedCommentCount}
      />

      {/* Main Interactive Canvas */}
      <Whiteboard
        elements={elements}
        comments={comments}
        localUser={localUser}
        currentTool={currentTool}
        toolProperties={toolProperties}
        gridType={gridType}
        theme={theme}
        onSetTool={setCurrentTool}
        onSetElement={setElement}
        onSetBatchElements={setBatchElements}
        onDeleteElement={deleteElement}
        onDeleteElements={deleteElements}
        getNextZIndex={getNextZIndex}
        stageRef={stageRef}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        onUploadImagePrompt={() => hiddenFileInputRef.current?.click()}
        clipboard={clipboard}
        onCopyElements={handleCopy}
        onCutElements={handleCut}
        onPasteElements={handlePaste}
        collaborators={collaborators}
        onUpdateCursor={updateCursor}
        onToggleReaction={toggleReaction}
        onOpenEmojiPicker={(elementId, position) => setActiveEmojiPicker({ elementId, position })}
        onOpenComments={(elementId) => setActiveCommentElementId(elementId)}
      />

      {/* Main Toolbar */}
      <MainToolbar
        currentTool={currentTool}
        theme={theme}
        onSelectTool={setCurrentTool}
        onUploadImage={handleUploadImage}
      />

      {/* Shortcuts & Gestures Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Emoji Picker Popover */}
      {activeEmojiPicker && (
        <EmojiPickerPopover
          isOpen={true}
          position={activeEmojiPicker.position}
          theme={theme}
          onClose={() => setActiveEmojiPicker(null)}
          onSelectEmoji={(emoji) => {
            toggleReaction(activeEmojiPicker.elementId, emoji);
            setActiveEmojiPicker(null);
          }}
        />
      )}

      {/* Threaded Comments Drawer/Modal */}
      {activeCommentElementId && (
        <CommentThreadModal
          isOpen={true}
          onClose={() => setActiveCommentElementId(null)}
          element={activeCommentElement}
          comments={comments}
          localUser={localUser}
          onAddComment={addComment}
          onAddReply={addReply}
          onDeleteComment={deleteComment}
          onToggleResolve={toggleResolveComment}
          theme={theme}
        />
      )}

      {/* Hidden File Input for Image Upload from Context Menu */}
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadImage(file);
            e.target.value = '';
          }
        }}
        className="hidden"
      />
    </div>
  );
}

export default App;
