import React from 'react';
import { X, Keyboard, Mouse, Sparkles } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const toolsShortcuts = [
    { key: 'V', desc: 'Select & Move Tool' },
    { key: 'H', desc: 'Hand / Pan Tool' },
    { key: 'K', desc: 'Laser Pointer' },
    { key: 'P', desc: 'Freehand Pen' },
    { key: 'R', desc: 'Rectangle' },
    { key: 'C', desc: 'Circle / Ellipse' },
    { key: 'F', desc: 'Frame / Artboard' },
    { key: 'A', desc: 'Arrow' },
    { key: 'L', desc: 'Straight Line' },
    { key: 'S', desc: 'Sticky Note' },
    { key: 'T', desc: 'Text Item' },
    { key: 'E', desc: 'Eraser' },
  ];

  const actionShortcuts = [
    { key: 'Right-Click', desc: 'Quick actions context menu' },
    { key: 'Space + Drag', desc: 'Pan canvas smoothly' },
    { key: 'Scroll Wheel', desc: 'Zoom in / out at cursor' },
    { key: 'Del / Backspace', desc: 'Delete selected elements (unlocked only)' },
    { key: 'Ctrl + L', desc: 'Lock / Unlock selected elements' },
    { key: 'Ctrl + G', desc: 'Group selected elements (2+ items)' },
    { key: 'Ctrl + Shift + G', desc: 'Ungroup selected elements' },
    { key: 'Ctrl + C / X / V', desc: 'Copy, Cut, and Paste' },
    { key: 'Ctrl + D', desc: 'Duplicate selected elements' },
    { key: 'Ctrl + ] / [', desc: 'Bring to Front / Send to Back' },
    { key: '] / [', desc: 'Bring Forward / Send Backward' },
    { key: 'Ctrl + Z', desc: 'Undo' },
    { key: 'Ctrl + Shift + Z / Y', desc: 'Redo' },
    { key: 'Ctrl + A', desc: 'Select all elements' },
    { key: 'Esc', desc: 'Deselect / Cancel edit' },
    { key: 'Double Click', desc: 'Edit Sticky Note or Text' },
    { key: 'Drag & Drop File', desc: 'Drop images directly onto canvas' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Keyboard Shortcuts & Gestures</h2>
            <p className="text-xs text-slate-400">Boost your workflow for school, planning, and marketing projects</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Tools */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Tool Hotkeys
            </h3>
            <div className="space-y-2">
              {toolsShortcuts.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{item.desc}</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-indigo-300 font-mono font-semibold">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas Actions & Gestures */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
              <Mouse className="w-3.5 h-3.5" /> Actions & Navigation
            </h3>
            <div className="space-y-2">
              {actionShortcuts.map((item) => (
                <div key={item.key} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{item.desc}</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono text-[11px]">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/30"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
