import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Undo2,
  Redo2,
  Download,
  Share2,
  Plus,
  Trash,
  HelpCircle,
  Check,
  Grid,
  FileJson,
  Upload,
  Layers,
  User,
  Radio,
  Pencil,
  Copy,
  Sun,
  Moon,
  FileText,
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import Konva from 'konva';
import { GridType, CanvasElement, Collaborator, ThemeMode } from '../../types/whiteboard';
import {
  exportStageToPNG,
  exportStageToJPG,
  exportStageToPDF,
  exportElementsToSVG,
  exportBoardToJson,
  importBoardFromJson,
} from '../../utils/exportUtils';

interface HeaderProps {
  boardId: string;
  boardName: string;
  onUpdateBoardName: (name: string) => void;
  isLoaded: boolean;
  isConnected: boolean;
  collaborators: Collaborator[];
  localUser: { name: string; color: string };
  onUpdateUserName: (name: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  canUndo: boolean;
  canRedo: boolean;
  gridType: GridType;
  onSetGridType: (type: GridType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewBoard: () => void;
  onClearAll: () => void;
  onOpenShortcuts: () => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  elements: CanvasElement[];
  onImportElements: (elements: CanvasElement[]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  boardId,
  boardName,
  onUpdateBoardName,
  isLoaded: _isLoaded,
  isConnected,
  collaborators,
  localUser,
  onUpdateUserName,
  theme,
  onToggleTheme,
  canUndo,
  canRedo,
  gridType,
  onSetGridType,
  onUndo,
  onRedo,
  onNewBoard,
  onClearAll,
  onOpenShortcuts,
  stageRef,
  elements,
  onImportElements,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [tempUserName, setTempUserName] = useState(localUser.name);

  // Inline Board Name Editing State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(boardName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    setNameInput(boardName);
  }, [boardName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    onUpdateBoardName(trimmed || 'New Whiteboard');
    setIsEditingName(false);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(boardId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const cleanFileName = (boardName || 'whiteboard').toLowerCase().replace(/[^a-z0-9]/gi, '-');

  const handleExportPNG = (pixelRatio: number, scope: 'viewport' | 'all') => {
    if (!stageRef.current) return;
    exportStageToPNG(stageRef.current, {
      pixelRatio,
      scope,
      fileName: `${cleanFileName}-${scope}-${pixelRatio}x.png`,
    });
    setShowExportMenu(false);
  };

  const handleExportJPG = () => {
    if (!stageRef.current) return;
    exportStageToJPG(stageRef.current, {
      pixelRatio: 2,
      scope: 'all',
      fileName: `${cleanFileName}-hq.jpg`,
    });
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    if (!stageRef.current) return;
    exportStageToPDF(stageRef.current, {
      fileName: `${cleanFileName}-document.pdf`,
      title: boardName,
      theme,
    });
    setShowExportMenu(false);
  };

  const handleExportSVG = () => {
    exportElementsToSVG(elements, {
      fileName: `${cleanFileName}-vector.svg`,
      theme,
    });
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportBoardToJson(elements, boardId);
    setShowExportMenu(false);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imported = await importBoardFromJson(file);
        onImportElements(imported);
      } catch (err: any) {
        alert(err.message || 'Failed to import JSON file');
      }
      e.target.value = '';
      setShowExportMenu(false);
    }
  };

  const totalUsersOnline = collaborators.length + 1;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 backdrop-blur-md border-b transition-colors ${
        isDark
          ? 'bg-slate-900/85 border-slate-800 text-slate-200'
          : 'bg-white/85 border-slate-200 text-slate-800'
      }`}
    >
      {/* Left: Brand & Board Management */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 flex-shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              scribblboard
            </h1>
          </div>
        </div>

        <div className={`w-[1px] h-6 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} mx-1`} />

        {/* Editable Board Name */}
        <div className="flex items-center">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') {
                  setNameInput(boardName);
                  setIsEditingName(false);
                }
              }}
              className={`px-2 py-1 text-xs font-semibold rounded-lg outline-none max-w-[180px] sm:max-w-[220px] ${
                isDark
                  ? 'text-white bg-slate-800 border border-indigo-500'
                  : 'text-slate-900 bg-slate-100 border border-indigo-500'
              }`}
              maxLength={40}
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl transition-all border border-transparent max-w-[180px] sm:max-w-[220px] ${
                isDark
                  ? 'text-slate-200 hover:text-white hover:bg-slate-800 hover:border-slate-700/60'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300'
              }`}
              title="Click to rename this whiteboard"
            >
              <span className="truncate">{boardName || 'New Whiteboard'}</span>
              <Pencil className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )}
        </div>

        {/* Saved Badge */}
        <div
          className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
            isDark
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
          title="Board changes are stored locally in IndexedDB and synchronized in real-time"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Saved</span>
        </div>

        {/* Copy Board ID Pill */}
        <div
          className={`hidden md:flex items-center gap-1.5 rounded-xl px-2.5 py-1 border ${
            isDark
              ? 'bg-slate-800/80 border-slate-700/60'
              : 'bg-slate-100 border-slate-200'
          }`}
        >
          <span className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            ID: <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{boardId.slice(0, 8)}</span>
          </span>
          <button
            onClick={handleCopyId}
            className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            title="Copy board ID"
          >
            {copiedId ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Share Link Button */}
        <button
          onClick={handleCopyLink}
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-xl transition-all shadow-sm ${
            copiedLink
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
          }`}
          title="Copy board URL to share and collaborate live"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5" /> Link Copied!
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" /> Share
            </>
          )}
        </button>

        {/* New Board Button */}
        <button
          onClick={onNewBoard}
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-xl border transition-all shadow-sm ${
            isDark
              ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border-slate-700/60'
              : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-300'
          }`}
          title="Create a fresh whiteboard with a new unique URL"
        >
          <Plus className="w-3.5 h-3.5" /> New Board
        </button>

        {/* Live WebRTC Sync Status & Collaborators */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Live Status Indicator */}
          <span
            className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
              isConnected
                ? isDark
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isDark
                ? 'bg-indigo-950/50 text-indigo-300 border-indigo-800/60'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}
            title="Real-time WebRTC Peer-to-Peer CRDT Sync is active"
          >
            <Radio className={`w-3 h-3 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-indigo-500'}`} />
            {isConnected ? `Live Sync (${totalUsersOnline} Online)` : 'Connecting P2P...'}
          </span>

          {/* User & Peer Avatars */}
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {/* Self Avatar */}
            <button
              onClick={() => {
                setTempUserName(localUser.name);
                setShowUserModal(true);
              }}
              className="relative group w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-slate-900 shadow-sm transition-transform hover:scale-110"
              style={{ backgroundColor: localUser.color }}
              title={`You: ${localUser.name} (Click to change)`}
            >
              {localUser.name.charAt(0).toUpperCase()}
            </button>

            {/* Remote Collaborators Avatars */}
            {collaborators.map((collab) => (
              <div
                key={collab.clientId}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-slate-900 shadow-sm"
                style={{ backgroundColor: collab.color }}
                title={`${collab.name} (Online)`}
              >
                {collab.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: History, Grid, Theme, Export & Help */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div
          className={`flex items-center rounded-xl p-0.5 border ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg transition-all ${
              canUndo
                ? isDark
                  ? 'text-slate-200 hover:bg-slate-700'
                  : 'text-slate-700 hover:bg-slate-200'
                : isDark
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg transition-all ${
              canRedo
                ? isDark
                  ? 'text-slate-200 hover:bg-slate-700'
                  : 'text-slate-700 hover:bg-slate-200'
                : isDark
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-400 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Grid Type Selector */}
        <div
          className={`hidden sm:flex items-center rounded-xl p-0.5 border ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {(['dots', 'grid', 'none'] as GridType[]).map((type) => (
            <button
              key={type}
              onClick={() => onSetGridType(type)}
              className={`px-2 py-1 text-xs font-medium rounded-lg capitalize transition-all ${
                gridType === type
                  ? 'bg-indigo-600 text-white shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {type === 'dots' ? <Grid className="w-3.5 h-3.5 inline mr-1" /> : null}
              {type}
            </button>
          ))}
        </div>

        {/* Theme Toggle (Light/Dark Mode) */}
        <button
          onClick={onToggleTheme}
          className={`p-1.5 rounded-xl border transition-all ${
            isDark
              ? 'text-amber-400 hover:text-amber-300 bg-slate-800 hover:bg-slate-700 border-slate-700/60'
              : 'text-indigo-600 hover:text-indigo-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
          }`}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>

          {showExportMenu && (
            <div
              className={`absolute right-0 mt-2 w-64 border rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Image & Document Exports
              </div>

              {/* High Res HD PNG */}
              <button
                onClick={() => handleExportPNG(2, 'all')}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-semibold text-indigo-400">Export All (High-Res)</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isDark ? 'bg-indigo-900/60 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
                  2x PNG
                </span>
              </button>

              {/* Ultra HD PNG */}
              <button
                onClick={() => handleExportPNG(3, 'all')}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ultra HD Print-Ready</span>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  3x PNG
                </span>
              </button>

              {/* Viewport PNG */}
              <button
                onClick={() => handleExportPNG(1, 'viewport')}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Current Viewport</span>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  1x PNG
                </span>
              </button>

              {/* JPEG Image */}
              <button
                onClick={handleExportJPG}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>JPEG Image (.jpg)</span>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  JPG
                </span>
              </button>

              {/* PDF Document */}
              <button
                onClick={handleExportPDF}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                  <span>PDF Document (.pdf)</span>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  PDF
                </span>
              </button>

              {/* Vector SVG (Google Docs/Slides & Microsoft Office) */}
              <button
                onClick={handleExportSVG}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
                title="Scalable Vector Graphics for Google Docs, Slides, MS Word, PowerPoint, & Illustrator"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vector SVG (.svg)</span>
                </div>
                <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Office & Google
                </span>
              </button>

              <div className={`w-full h-[1px] my-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

              <div className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Data Backup & Restore
              </div>
              <button
                onClick={handleExportJSON}
                className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <FileJson className="w-3.5 h-3.5 text-amber-400" /> Save Backup (.json)
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 text-xs rounded-xl transition-all text-left ${
                  isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" /> Import Backup (.json)
              </button>
            </div>
          )}
        </div>

        {/* Hidden JSON File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJSON}
          className="hidden"
        />

        {/* Clear Board */}
        <button
          onClick={() => setShowClearConfirm(true)}
          className={`p-1.5 rounded-xl border transition-all ${
            isDark
              ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800 border-slate-800'
              : 'text-slate-500 hover:text-red-500 hover:bg-slate-100 border-slate-200'
          }`}
          title="Clear Board"
        >
          <Trash className="w-4 h-4" />
        </button>

        {/* Shortcuts Help Modal Button */}
        <button
          onClick={onOpenShortcuts}
          className={`p-1.5 rounded-xl border transition-all ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
          }`}
          title="Keyboard Shortcuts & Gestures"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Clear Confirmation Modal (Centered in window) */}
      {showClearConfirm &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className={`border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h3 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Clear Entire Whiteboard?
              </h3>
              <p className={`text-xs mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                This will remove all shapes, notes, and drawings on this board. You can still undo this action immediately with Ctrl+Z.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                    isDark
                      ? 'text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onClearAll();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-600/20"
                >
                  Clear Board
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* User Nickname Change Modal */}
      {showUserModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className={`border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                  style={{ backgroundColor: localUser.color }}
                >
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Your Display Profile</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Shown to other collaborators in real-time</p>
                </div>
              </div>

              <div className="mb-4">
                <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Collaborator Nickname
                </label>
                <input
                  type="text"
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  placeholder="Enter your name"
                  className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-indigo-500 transition-colors ${
                    isDark
                      ? 'bg-slate-950 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                  maxLength={30}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowUserModal(false)}
                  className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                    isDark
                      ? 'text-slate-300 hover:text-white bg-slate-800'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (tempUserName.trim()) {
                      onUpdateUserName(tempUserName.trim());
                    }
                    setShowUserModal(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};
