import React, { useSyncExternalStore, useCallback } from 'react';
import {
  subscribe,
  getSnapshot,
  getActiveEditor,
  hasStagedEdits,
} from '../../stores/activeEditorStore';

const FONTS = ['Original', 'Arial', 'Times New Roman', 'Courier', 'Verdana', 'Georgia'];

/**
 * GlobalFormatToolbar
 *
 * Renders in the top bar of PDFEditorPage and operates on the currently active
 * CanvasInlineEditor via activeEditorStore.  When no editor is active the
 * toolbar is rendered but every control is disabled/greyed.
 *
 * CRITICAL: every interactive element uses onMouseDown={e => e.preventDefault()}
 * so clicking toolbar buttons never steals focus from the active textarea
 * (MDN-standard pattern for format toolbars: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/contenteditable).
 */
export default function GlobalFormatToolbar() {
  // Re-renders whenever the active editor changes or its state changes.
  const state = useSyncExternalStore(subscribe, getSnapshot);

  // Also subscribe to get hasStagedEdits for the X button visibility
  // (hasStagedEdits subscription is handled by parent, but we need active state)
  const hasActive = state !== null;

  const callEditor = useCallback((method, ...args) => {
    const editor = getActiveEditor();
    if (editor && typeof editor[method] === 'function') {
      editor[method](...args);
    }
  }, []);

  const preventFocusSteal = (e) => e.preventDefault();

  const fontName = state?.fontFamily ?? 'Original';
  const isEmbedded = state?.isFontEmbeddedAndActive ?? false;
  const sizePx = state?.size != null ? Math.round(state.size) : '—';
  const color = state?.color ?? '#000000';
  const isBold = state?.isBold ?? false;
  const isItalic = state?.isItalic ?? false;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all duration-150 ${
        hasActive
          ? 'border-blue-500/50 dark:border-blue-500/60 bg-white dark:bg-neutral-900 shadow-md shadow-blue-500/5 text-slate-800 dark:text-white ring-2 ring-blue-500/20'
          : 'border-slate-300 dark:border-neutral-700 bg-slate-100/80 dark:bg-neutral-800/80 text-slate-500 dark:text-neutral-400 select-none'
      }`}
      // Stop clicks from bubbling to the canvas area
      onClick={e => e.stopPropagation()}
    >
      {/* Font name + embedded badge + size */}
      <div className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
        <span
          className={`max-w-[130px] truncate font-sans text-[11px] ${
            hasActive
              ? 'text-slate-800 dark:text-slate-100 font-semibold'
              : 'text-slate-500 dark:text-neutral-400 font-medium'
          }`}
          title={fontName}
        >
          {fontName === 'Original' ? 'Original Font' : fontName}
        </span>

        {hasActive && (
          <span
            className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border ${
              isEmbedded
                ? 'text-emerald-800 bg-emerald-100 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-700'
                : 'text-amber-800 bg-amber-100 border-amber-300 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-700'
            }`}
            title={isEmbedded ? 'Using exact embedded font from PDF' : 'Using browser fallback font'}
          >
            {isEmbedded ? '✓ Emb' : '⚠ Fallback'}
          </span>
        )}

        <span
          className={`text-[11px] font-mono font-semibold ${
            hasActive
              ? 'text-slate-700 dark:text-neutral-300'
              : 'text-slate-400 dark:text-neutral-500'
          }`}
        >
          {sizePx}px
        </span>
      </div>

      <div className={`w-px h-4 mx-0.5 ${hasActive ? 'bg-slate-300 dark:bg-neutral-700' : 'bg-slate-300/60 dark:bg-neutral-700/60'}`} />

      {/* Font family selector */}
      <select
        value={fontName}
        onChange={e => callEditor('setFontFamily', e.target.value)}
        disabled={!hasActive}
        className={`text-[11px] font-semibold border rounded-lg px-2 py-0.5 outline-none transition-colors ${
          hasActive
            ? 'bg-white dark:bg-neutral-800 text-slate-800 dark:text-white border-slate-300 dark:border-neutral-600 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer'
            : 'bg-slate-200/50 dark:bg-neutral-800/50 text-slate-400 dark:text-neutral-500 border-slate-300/70 dark:border-neutral-700/70 cursor-not-allowed'
        }`}
        onMouseDown={preventFocusSteal}
        title="Change font family"
      >
        {FONTS.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* Color swatch */}
      <input
        type="color"
        value={color}
        onChange={e => callEditor('setColor', e.target.value)}
        disabled={!hasActive}
        className={`w-6 h-6 p-0 border rounded-md cursor-pointer transition-opacity ${
          hasActive
            ? 'border-slate-300 dark:border-neutral-600 hover:scale-105'
            : 'border-slate-300/60 dark:border-neutral-700/60 opacity-40 cursor-not-allowed'
        }`}
        title="Text color"
        onMouseDown={preventFocusSteal}
      />

      <div className={`w-px h-4 mx-0.5 ${hasActive ? 'bg-slate-300 dark:bg-neutral-700' : 'bg-slate-300/60 dark:bg-neutral-700/60'}`} />

      {/* Bold */}
      <button
        onMouseDown={preventFocusSteal}
        onClick={() => callEditor('applyBold')}
        disabled={!hasActive}
        className={`w-6.5 h-6.5 flex items-center justify-center text-xs font-bold rounded-md transition-all ${
          !hasActive
            ? 'text-slate-300 dark:text-neutral-600 cursor-not-allowed'
            : isBold
              ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Bold (Ctrl+B)"
      >
        B
      </button>

      {/* Italic */}
      <button
        onMouseDown={preventFocusSteal}
        onClick={() => callEditor('applyItalic')}
        disabled={!hasActive}
        className={`w-6.5 h-6.5 flex items-center justify-center text-xs italic font-semibold rounded-md transition-all ${
          !hasActive
            ? 'text-slate-300 dark:text-neutral-600 cursor-not-allowed'
            : isItalic
              ? 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-xs'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Italic (Ctrl+I)"
      >
        I
      </button>

      <div className={`w-px h-4 mx-0.5 ${hasActive ? 'bg-slate-300 dark:bg-neutral-700' : 'bg-slate-300/60 dark:bg-neutral-700/60'}`} />

      {/* Size decrease */}
      <button
        onMouseDown={preventFocusSteal}
        onClick={() => callEditor('setSizeAdj', -1)}
        disabled={!hasActive}
        className={`px-1.5 py-0.5 text-[11px] font-bold rounded-md transition-all ${
          !hasActive
            ? 'text-slate-300 dark:text-neutral-600 cursor-not-allowed'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Decrease font size"
      >
        A−
      </button>

      {/* Size increase */}
      <button
        onMouseDown={preventFocusSteal}
        onClick={() => callEditor('setSizeAdj', +1)}
        disabled={!hasActive}
        className={`px-1.5 py-0.5 text-[11px] font-bold rounded-md transition-all ${
          !hasActive
            ? 'text-slate-300 dark:text-neutral-600 cursor-not-allowed'
            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Increase font size"
      >
        A+
      </button>

      <div className={`w-px h-4 mx-0.5 ${hasActive ? 'bg-slate-300 dark:bg-neutral-700' : 'bg-slate-300/60 dark:bg-neutral-700/60'}`} />

      {/* X — discard active editor only */}
      <button
        onMouseDown={preventFocusSteal}
        onClick={() => callEditor('discard')}
        disabled={!hasActive}
        className={`w-6.5 h-6.5 flex items-center justify-center text-xs font-bold rounded-md transition-all ${
          !hasActive
            ? 'text-slate-300 dark:text-neutral-600 cursor-not-allowed'
            : 'text-slate-500 dark:text-neutral-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300'
        }`}
        title="Discard this paragraph's edit (X)"
      >
        ✕
      </button>
    </div>
  );
}
