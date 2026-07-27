import React from 'react';
import { Trash2 } from 'lucide-react';

const FONTS = ['Helvetica', 'Times-Roman', 'Courier'];
const SHAPES = [
  { id: 'rect',   label: '▭ Rectangle' },
  { id: 'circle', label: '○ Circle'    },
  { id: 'line',   label: '╱ Line'      },
  { id: 'arrow',  label: '→ Arrow'     },
];
const HIGHLIGHT_COLORS = ['#FFD700', '#7CFC00', '#FF6B6B', '#6B9FFF', '#FF9500', '#FF6BE8'];
const STROKE_COLORS    = ['#000000', '#FF0000', '#0000FF', '#00AA00', '#FF6600', '#AA00AA', '#FFFFFF'];
const STICKY_COLORS    = ['#FFD700', '#FF9500', '#FF6B6B', '#6B9FFF', '#7CFC00', '#FF6BE8'];

function ColorDot({ color, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(color)}
      title={color}
      style={{ background: color }}
      className={`w-6 h-6 rounded-full border-2 transition-all ${
        selected
          ? 'border-purple-500 scale-110 shadow-md shadow-purple-400/30'
          : 'border-slate-300 dark:border-white/20 hover:scale-110'
      }`}
    />
  );
}

function Label({ children }) {
  return <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-neutral-500 mb-1.5">{children}</p>;
}

function ToolBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all text-left ${
        active
          ? 'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300'
          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export default function RightPanel({
  activeTool, toolSettings, onUpdateSettings,
  canvasAnnotations, onDeleteCanvasAnnotation,
  onFinishAndExport, hasFile,
}) {
  const s = toolSettings;
  const upd = onUpdateSettings;
  const annCount = canvasAnnotations.length;

  const TOOL_LABELS = {
    select: '↖ Select / Move',
    edit_text: '✏️ Edit PDF Text',
    text: '🔤 New Text Box',
    highlight: '🖊 Highlight',
    draw: '✏️ Freehand Draw',
    shape: '⬛ Shapes',
    eraser: '⬜ Eraser',
    sticky: '📝 Sticky Note',
    image: '🖼 Insert Image',
    signature: '✍️ Signature',
  };

  return (
    <div className="w-60 shrink-0 flex flex-col bg-white dark:bg-[#111] border-l border-slate-200 dark:border-white/8">

      {/* ── Tool settings ── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
          {TOOL_LABELS[activeTool] ?? 'Tools'}
        </h3>

        {/* SELECT */}
        {activeTool === 'select' && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
              Click any text on the PDF page to select and edit it inline. Drag annotations to reposition them.
            </p>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 rounded-xl">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-300 block mb-1">💡 Quick Tip</span>
              <p className="text-[11px] text-purple-700 dark:text-purple-300/80 leading-normal">
                Click the <strong>Edit PDF Text</strong> button on the toolbar or click directly on any sentence in the document.
              </p>
            </div>
          </div>
        )}

        {/* EDIT TEXT */}
        {activeTool === 'edit_text' && (
          <div className="flex flex-col gap-3">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 rounded-xl">
              <span className="text-xs font-bold text-purple-900 dark:text-purple-300 block mb-1">✏️ Inline Text Mode</span>
              <p className="text-[11px] text-purple-700 dark:text-purple-300/80 leading-normal">
                Hover over any sentence or header in the document and click to start typing directly over the original text.
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
              Changes will automatically whiteout original text and burn updated text into the exported PDF.
            </p>
          </div>
        )}


        {/* TEXT */}
        {activeTool === 'text' && (
          <>
            <div>
              <Label>Font Family</Label>
              <div className="flex flex-col gap-1">
                {FONTS.map(f => (
                  <ToolBtn key={f} active={s.fontFamily === f} onClick={() => upd({ fontFamily: f })}>{f}</ToolBtn>
                ))}
              </div>
            </div>
            <div>
              <Label>Font Size</Label>
              <div className="flex items-center gap-2">
                <button onClick={() => upd({ fontSize: Math.max(6, s.fontSize - 2) })}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all">−</button>
                <span className="flex-1 text-center text-sm font-mono font-bold text-slate-900 dark:text-white">{s.fontSize}pt</span>
                <button onClick={() => upd({ fontSize: Math.min(96, s.fontSize + 2) })}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/10 transition-all">+</button>
              </div>
            </div>
            <div>
              <Label>Style</Label>
              <div className="flex gap-2">
                {[{k:'bold',l:'B',cls:'font-bold'},{k:'italic',l:'I',cls:'italic'},{k:'underline',l:'U',cls:'underline'}].map(({k,l,cls}) => (
                  <button key={k} onClick={() => upd({ [k]: !s[k] })}
                    className={`flex-1 h-8 rounded-lg border text-xs ${cls} transition-all ${
                      s[k]
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Text Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={s.color}
                  onChange={e => upd({ color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-white/10 p-0.5 bg-transparent" />
                <span className="text-xs font-mono text-slate-500 dark:text-neutral-400">{s.color}</span>
              </div>
            </div>
          </>
        )}

        {/* HIGHLIGHT */}
        {activeTool === 'highlight' && (
          <>
            <div>
              <Label>Highlight Color</Label>
              <div className="flex gap-2 flex-wrap">
                {HIGHLIGHT_COLORS.map(c => (
                  <ColorDot key={c} color={c} selected={s.highlightColor === c} onClick={v => upd({ highlightColor: v })} />
                ))}
                <input type="color" value={s.highlightColor}
                  onChange={e => upd({ highlightColor: e.target.value })}
                  className="w-6 h-6 rounded-full cursor-pointer border border-slate-200 dark:border-white/10 p-0.5 bg-transparent" />
              </div>
            </div>
            <div>
              <Label>Opacity — {Math.round(s.opacity * 100)}%</Label>
              <input type="range" min="0.1" max="1" step="0.05" value={s.opacity}
                onChange={e => upd({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>
          </>
        )}

        {/* DRAW */}
        {activeTool === 'draw' && (
          <>
            <div>
              <Label>Pen Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={s.color}
                  onChange={e => upd({ color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-white/10 p-0.5 bg-transparent" />
                <span className="text-xs font-mono text-slate-500 dark:text-neutral-400">{s.color}</span>
              </div>
            </div>
            <div>
              <Label>Stroke Width — {s.strokeWidth}px</Label>
              <input type="range" min="1" max="20" step="1" value={s.strokeWidth}
                onChange={e => upd({ strokeWidth: parseInt(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>
          </>
        )}

        {/* SHAPE */}
        {activeTool === 'shape' && (
          <>
            <div>
              <Label>Shape Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {SHAPES.map(sh => (
                  <ToolBtn key={sh.id} active={s.shapeType === sh.id} onClick={() => upd({ shapeType: sh.id })}>{sh.label}</ToolBtn>
                ))}
              </div>
            </div>
            <div>
              <Label>Stroke Color</Label>
              <div className="flex gap-1.5 flex-wrap">
                {STROKE_COLORS.map(c => (
                  <ColorDot key={c} color={c} selected={s.color === c} onClick={v => upd({ color: v })} />
                ))}
              </div>
            </div>
            <div>
              <Label>Fill Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={s.fillColor || '#ffffff'}
                  onChange={e => upd({ fillColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-white/10 p-0.5 bg-transparent" />
                <button onClick={() => upd({ fillColor: null })}
                  className="text-xs text-slate-500 dark:text-neutral-400 hover:text-rose-500 transition-colors">
                  Clear fill
                </button>
              </div>
            </div>
            <div>
              <Label>Stroke Width — {s.strokeWidth}px</Label>
              <input type="range" min="1" max="12" step="1" value={s.strokeWidth}
                onChange={e => upd({ strokeWidth: parseInt(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>
          </>
        )}

        {/* ERASER */}
        {activeTool === 'eraser' && (
          <>
            <p className="text-xs text-slate-500 dark:text-neutral-500 leading-relaxed">
              Drag to draw a white whiteout rectangle over content you want to erase. Baked permanently on export.
            </p>
            <div>
              <Label>Eraser Size — {s.strokeWidth}px</Label>
              <input type="range" min="1" max="30" step="1" value={s.strokeWidth}
                onChange={e => upd({ strokeWidth: parseInt(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>
          </>
        )}

        {/* STICKY */}
        {activeTool === 'sticky' && (
          <>
            <div>
              <Label>Note Color</Label>
              <div className="flex gap-2 flex-wrap">
                {STICKY_COLORS.map(c => (
                  <ColorDot key={c} color={c} selected={s.stickyColor === c} onClick={v => upd({ stickyColor: v })} />
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-500">Click anywhere on the PDF page to place a sticky note.</p>
          </>
        )}

        {/* IMAGE */}
        {activeTool === 'image' && (
          <p className="text-xs text-slate-500 dark:text-neutral-500 leading-relaxed">
            Drag &amp; drop an image file onto any PDF page. Images are baked into the PDF on export.
          </p>
        )}

        {/* SIGNATURE */}
        {activeTool === 'signature' && (
          <>
            <div>
              <Label>Ink Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={s.color}
                  onChange={e => upd({ color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 dark:border-white/10 p-0.5 bg-transparent" />
                <span className="text-xs font-mono text-slate-500 dark:text-neutral-400">{s.color}</span>
              </div>
            </div>
            <div>
              <Label>Stroke Width — {s.strokeWidth}px</Label>
              <input type="range" min="0.5" max="8" step="0.5" value={s.strokeWidth}
                onChange={e => upd({ strokeWidth: parseFloat(e.target.value) })}
                className="w-full accent-purple-500" />
            </div>
          </>
        )}
      </div>

      {/* ── Annotation list ── */}
      {annCount > 0 && (
        <div className="border-t border-slate-200 dark:border-white/8 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-700 dark:text-white">
              {annCount} annotation{annCount !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => canvasAnnotations.forEach(a => onDeleteCanvasAnnotation(a.id))}
              className="text-[10px] text-rose-500 hover:text-rose-600 font-semibold transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
            {canvasAnnotations.map(ann => (
              <div key={ann.id} className="flex items-center justify-between bg-slate-50 dark:bg-white/5 rounded-lg px-2 py-1.5">
                <span className="text-[11px] text-slate-600 dark:text-neutral-400 capitalize truncate">
                  {ann.type} · p{(ann.pageIndex ?? 0) + 1}
                </span>
                <button
                  onClick={() => onDeleteCanvasAnnotation(ann.id)}
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors ml-1 shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Finish & Export ── */}
      <div className="p-3 border-t border-slate-200 dark:border-white/8 shrink-0">
        <button
          onClick={onFinishAndExport}
          disabled={!hasFile}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-md hover:from-purple-700 hover:to-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ✓ Finish &amp; Export PDF
        </button>
      </div>
    </div>
  );
}
