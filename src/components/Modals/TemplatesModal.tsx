import React from 'react';
import { ThemeMode } from '../../types/whiteboard';
import { LayoutTemplate, X, Columns, GitCommit, Sparkles } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: 'retro' | 'kanban' | 'flowchart' | 'swot') => void;
  theme: ThemeMode;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  theme,
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';

  const templates = [
    {
      id: 'kanban' as const,
      name: 'Kanban Board',
      description: '3 framed columns (To Do, In Progress, Done) with initial task cards.',
      icon: <Columns className="w-6 h-6 text-indigo-500" />,
      tag: 'Agile & Workflow',
    },
    {
      id: 'retro' as const,
      name: 'Sprint Retrospective',
      description: '3 color-coded sticky columns: What went well, What could improve, Action items.',
      icon: <Sparkles className="w-6 h-6 text-pink-500" />,
      tag: 'Team Collaboration',
    },
    {
      id: 'flowchart' as const,
      name: 'Flowchart Starter',
      description: 'Standard decision diamond, process cards, and connecting labeled arrows.',
      icon: <GitCommit className="w-6 h-6 text-amber-500" />,
      tag: 'Diagramming',
    },
    {
      id: 'swot' as const,
      name: 'SWOT Analysis Matrix',
      description: '2x2 structured matrix for Strengths, Weaknesses, Opportunities, and Threats.',
      icon: <LayoutTemplate className="w-6 h-6 text-emerald-500" />,
      tag: 'Strategy',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold">Starter Templates</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => {
                onSelectTemplate(tpl.id);
                onClose();
              }}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between ${
                isDark
                  ? 'border-slate-800 bg-slate-800/50 hover:bg-slate-800 hover:border-indigo-500/50'
                  : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-400 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10">{tpl.icon}</div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {tpl.tag}
                  </span>
                </div>
                <h3 className="font-semibold text-sm mb-1">{tpl.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <button
                className="mt-4 w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Insert Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
