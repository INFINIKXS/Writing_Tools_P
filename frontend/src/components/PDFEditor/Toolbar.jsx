import React, { useRef } from 'react';
import {
  MousePointer2, FileEdit, Type, Highlighter, PenLine, Shapes, Eraser,
  StickyNote, Image, PenTool, Wand2, Upload, Download,
} from 'lucide-react';

const TOOLS = [
  { id: 'select',    icon: MousePointer2, label: 'Select / Move',     divider: false },
  { id: 'edit_text', icon: FileEdit,      label: 'Edit PDF Text',     divider: false },
  { id: 'text',      icon: Type,          label: 'Add New Text Box',  divider: false },
  { id: 'highlight', icon: Highlighter,   label: 'Highlight Area',     divider: false },
  { id: 'draw',      icon: PenLine,       label: 'Freehand Draw',      divider: false },
  { id: 'shape',     icon: Shapes,        label: 'Insert Shape',       divider: false },
  { id: 'eraser',    icon: Eraser,        label: 'Eraser / Whiteout',  divider: true  },
  { id: 'sticky',    icon: StickyNote,    label: 'Sticky Note',        divider: false },
  { id: 'image',     icon: Image,         label: 'Insert Image',       divider: false },
  { id: 'signature', icon: PenTool,       label: 'Signature',          divider: false },
];

function TooltipButton({ children, label, isActive, disabled, onClick }) {
  return (
    <div className="relative group flex items-center">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
          disabled
            ? 'opacity-30 cursor-not-allowed text-slate-400 dark:text-neutral-600'
            : isActive
              ? 'bg-purple-600/20 text-purple-700 dark:text-purple-400 border border-purple-500/40 shadow-inner'
              : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        {children}
      </button>

      {/* Floating Instant Tooltip Label */}
      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 transform -translate-x-1 group-hover:translate-x-0 z-[500]">
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-800" />
        {label}
      </div>
    </div>
  );
}

export default function Toolbar({
  activeTool, onSetTool,
  onUpload,
  onAddText,
  onToggleWand, isWandActive,
  onSave, hasFile,
}) {
  const fileInputRef = useRef(null);

  return (
    <div className="w-14 shrink-0 flex flex-col items-center gap-1 bg-white dark:bg-[#111] border-r border-slate-200 dark:border-white/8 py-3 overflow-visible z-30">
      {/* Open PDF */}
      <TooltipButton
        label="Open PDF Document"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={18} />
      </TooltipButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0]); }}
      />

      <div className="w-8 h-px bg-slate-200 dark:bg-white/10 my-1" />

      {/* Annotation & Edit tools */}
      {TOOLS.map((tool) => (
        <React.Fragment key={tool.id}>
          <TooltipButton
            label={tool.label}
            isActive={activeTool === tool.id}
            onClick={() => {
              onSetTool(tool.id);
              if (tool.id === 'text') onAddText?.();
            }}
          >
            <tool.icon size={18} />
          </TooltipButton>
          {tool.divider && <div className="w-8 h-px bg-slate-200 dark:bg-white/10 my-1" />}
        </React.Fragment>
      ))}

      <div className="w-8 h-px bg-slate-200 dark:bg-white/10 my-1" />

      {/* Magic Wand */}
      <TooltipButton
        label="Auto-Detect Font (Magic Wand)"
        isActive={isWandActive}
        onClick={onToggleWand}
      >
        <Wand2 size={18} />
      </TooltipButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save / Export */}
      <TooltipButton
        label="Finish & Export PDF"
        disabled={!hasFile}
        onClick={onSave}
      >
        <Download size={18} />
      </TooltipButton>
    </div>
  );
}
