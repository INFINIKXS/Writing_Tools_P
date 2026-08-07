import React, { useState, useCallback, useRef, useMemo, useEffect, useSyncExternalStore } from 'react';
import Toolbar from '../components/PDFEditor/Toolbar';
import RightPanel from '../components/PDFEditor/RightPanel';
import PDFViewer from '../components/PDFEditor/Viewer';
import GlobalFormatToolbar from '../components/PDFEditor/GlobalFormatToolbar';
import { applyTextAnnotations } from '../utils/pdfModifier';
import { pdfEditStore, activeFileId } from '../stores/pdfEditStore';
import { pdfTypographyStore } from '../stores/pdfTypographyStore';
import { subscribe as subscribeActiveEditor, getDirtySnapshot } from '../stores/activeEditorStore';

// ─── Error Boundary ──────────────────────────────────────────────────────────
class PDFErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('PDFViewer Error Boundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white dark:bg-[#111] text-slate-800 dark:text-slate-200">
          <h2 className="text-lg font-bold text-rose-600 mb-2">PDF Viewer Error</h2>
          <p className="text-sm text-slate-500 mb-4 max-w-md">{this.state.error?.message || 'An unexpected error occurred rendering the PDF.'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 text-xs transition-all"
          >
            Retry Viewer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PDFEditorPage({ initialToolId = null }) {
  const [currentFile, setCurrentFile] = useState(null);
  const [_fileBytes, setFileBytes] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [spacingData, setSpacingData] = useState(null);

  // Legacy overlay annotations (draggable text boxes / whiteout)
  const [annotations, setAnnotations] = useState([]);

  // New canvas annotations for bake-annotations endpoint
  const [canvasAnnotations, setCanvasAnnotations] = useState([]);

  const [isWandActive, setIsWandActive] = useState(false);
  const [defaultStyle, setDefaultStyle] = useState({ font: 'Helvetica', size: 16 });
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);
  const [isLiveBaking, setIsLiveBaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analyzeAbortRef = useRef(null);
  const objectUrlRef = useRef(null);
  const prevLiveUrlRef = useRef(null);
  const [fontWarnings, setFontWarnings] = useState([]);

  // ── bakeAll: ref populated by PDFViewer via onBakeAllReady ───────────────
  const bakeAllRef = useRef(null);

  // Reactively subscribe to dirty staged edits for Done button enabled state
  const hasStaged = useSyncExternalStore(subscribeActiveEditor, getDirtySnapshot);

  // ── Active tool & settings ────────────────────────────────────────────────
  // activeTool: 'select' | 'text' | 'highlight' | 'draw' | 'shape' | 'eraser' | 'sticky' | 'image' | 'signature'
  const [activeTool, setActiveTool] = useState('select');

  useEffect(() => {
    if (initialToolId) {
      setActiveTool(initialToolId);
    }
  }, [initialToolId]);
  const [toolSettings, setToolSettings] = useState({
    color: '#000000',
    highlightColor: '#FFD700',
    fillColor: null,
    strokeWidth: 2,
    fontSize: 14,
    fontFamily: 'Helvetica',
    bold: false,
    italic: false,
    underline: false,
    opacity: 0.45,
    shapeType: 'rect',
    stickyColor: '#FFD700',
  });

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      // Cancel any pending analysis on unmount
      if (analyzeAbortRef.current) analyzeAbortRef.current.abort();
    };
  }, []);

  // ── Tab-visibility recovery ───────────────────────────────────────────────
  // If the user switches tabs while extract-spacing is in-flight the browser
  // throttles or drops the network request. When they come back we detect the
  // still-pending state and retry the analysis automatically.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !spacingData && currentFile && !isAnalyzing) {
        handleUpload(currentFile);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacingData, currentFile, isAnalyzing]);

  const viewerFile = useMemo(
    () => livePreviewUrl ? { url: livePreviewUrl } : currentFile,
    [livePreviewUrl, currentFile]
  );

  const handleUpload = async (file) => {
    if (!file) return;
    setCurrentFile(file);
    const reader = new FileReader();
    reader.onload = () => { setFileBytes(reader.result); };
    reader.readAsArrayBuffer(file);
    setIsAnalyzing(true);
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    try {
      const fd = new FormData();
      fd.append('file', file, 'document.pdf');
      const res = await fetch('http://127.0.0.1:8000/api/pdf/extract-spacing', {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });
      if (res.ok) {
        const payload = await res.json();
        setSpacingData(payload);
        pdfTypographyStore.setTypographyData(activeFileId, payload);
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error('extract-spacing error:', e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // handleDocumentSwap is called from inside bakeAll's flushSync.
  // It atomically updates currentFile + spacingData in the same React frame
  // that the pre-rendered bitmap appears and staged editors are unmounted.
  const handleDocumentSwap = useCallback(({ newUrl, newSpacing }) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = newUrl;
    setCurrentFile(newUrl);
    setLivePreviewUrl(null);
    if (newSpacing) {
      setSpacingData(newSpacing);
      pdfTypographyStore.setTypographyData(activeFileId, newSpacing);
    }
  }, []);

  const handleAddText = () => {
    const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
    setAnnotations(prev => [...prev, {
      id: newId, type: 'text', text: 'New Text Box', x: 50, y: 50, pageIndex: 0,
      size: defaultStyle.size, font: defaultStyle.font, isEditing: true,
    }]);
  };

  const _handleAddRedaction = () => {
    const newId = Date.now().toString() + Math.random().toString().slice(2, 6);
    setAnnotations(prev => [...prev, { id: newId, type: 'redact', x: 50, y: 100, width: 150, height: 24, pageIndex: 0 }]);
  };

  const addCanvasAnnotation = useCallback((ann) => {
    setCanvasAnnotations(prev => [...prev, {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      ...ann,
    }]);
  }, []);

  const deleteCanvasAnnotation = useCallback((id) => {
    setCanvasAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateAnnotation = useCallback((updated) => {
    setAnnotations(prev => prev.map(a => a.id === updated.id ? updated : a));
  }, []);

  const deleteAnnotation = useCallback((idToDelete) => {
    setAnnotations(prev => prev.filter(a => a.id !== idToDelete));
  }, []);

  const handleCanvasClick = async (pageIndex, unscaledX, unscaledY) => {
    if (!isWandActive || !currentFile) return;
    setIsWandActive(false);
    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('page_index', pageIndex);
    formData.append('x', unscaledX);
    formData.append('y', unscaledY);
    try {
      const resp = await fetch(`http://127.0.0.1:8000/api/pdf/detect_font`, { method: 'POST', body: formData });
      const data = await resp.json();
      if (data && data.font) {
        let matchedFont = 'Helvetica';
        const fLow = data.font.toLowerCase();
        if (fLow.includes('time') || fLow.includes('serif')) matchedFont = 'Times-Roman';
        else if (fLow.includes('courier') || fLow.includes('mono')) matchedFont = 'Courier';
        setDefaultStyle({ font: matchedFont, size: data.size });
        alert(`Detected PDF native font: ${data.font}\nDetected size: ${data.size}pt\n\nText formatter calibrated to match (${matchedFont}, ${data.size}pt)!`);
      }
    } catch (err) { console.error(err); alert('Error reaching Python font analyzer: ' + err.message); }
  };

  // ── Finish & Export: inline edits → overlay annotations → bake-annotations ─
  const handleFinishAndExport = async () => {
    if (!currentFile && !fileBytes) return;
    setIsLiveBaking(true);
    try {
      let workingBlob;
      const inlineEdits = pdfEditStore.getEdits(activeFileId);

      // Step 1: apply inline text edits via apply-edits if any
      if (inlineEdits.length > 0) {
        const fd = new FormData();
        let sourceFile;
        if (typeof currentFile === 'string') {
          const r = await fetch(currentFile);
          sourceFile = new File([await r.blob()], 'document.pdf', { type: 'application/pdf' });
        } else { sourceFile = currentFile; }
        fd.append('file', sourceFile, 'document.pdf');
        fd.append('edits', JSON.stringify(inlineEdits));
        const res = await fetch('http://127.0.0.1:8000/api/pdf/apply-edits', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('apply-edits failed');
        workingBlob = await res.blob();
        pdfEditStore.clear(activeFileId);
      } else {
        if (typeof currentFile === 'string') {
          const r = await fetch(currentFile); workingBlob = await r.blob();
        } else if (currentFile instanceof File || currentFile instanceof Blob) {
          workingBlob = currentFile;
        } else {
          workingBlob = new Blob([fileBytes], { type: 'application/pdf' });
        }
      }

      // Step 2: apply legacy overlay annotations via pdf-lib
      if (annotations.length > 0) {
        const overlayBytes = await workingBlob.arrayBuffer();
        const editedBytes = await applyTextAnnotations(overlayBytes, annotations);
        workingBlob = new Blob([editedBytes], { type: 'application/pdf' });
      }

      // Step 3: bake canvas annotations (highlight, shape, draw, sticky, image)
      if (canvasAnnotations.length > 0) {
        const fd2 = new FormData();
        fd2.append('file', new File([workingBlob], 'document.pdf', { type: 'application/pdf' }), 'document.pdf');
        fd2.append('annotations', JSON.stringify(canvasAnnotations));
        const res2 = await fetch('http://127.0.0.1:8000/api/pdf/bake-annotations', { method: 'POST', body: fd2 });
        if (!res2.ok) throw new Error('bake-annotations failed');
        workingBlob = await res2.blob();
      }

      // Step 4: download
      const fileName = typeof currentFile === 'string'
        ? 'edited_document.pdf'
        : `edited_${currentFile?.name || 'document.pdf'}`;
      const url = URL.createObjectURL(workingBlob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);

      setCanvasAnnotations([]);
      setAnnotations([]);
    } catch (err) {
      console.error('Finish & Export error:', err);
      alert('Export failed: ' + err.message);
    } finally { setIsLiveBaking(false); }
  };

  return (
    <div className={`flex h-full bg-slate-50 dark:bg-[#0a0a0a] font-sans overflow-hidden ${isWandActive ? 'cursor-crosshair' : ''}`}>
      {/* Left Vertical Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onSetTool={setActiveTool}
        onUpload={handleUpload}
        onZoomIn={() => setScale(s => s + 0.2)}
        onZoomOut={() => setScale(s => Math.max(0.4, s - 0.2))}
        onAddText={handleAddText}
        onToggleWand={() => setIsWandActive(!isWandActive)}
        isWandActive={isWandActive}
        onSave={handleFinishAndExport}
        hasFile={!!currentFile}
      />

      {/* Center: top bar + PDF canvas */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#111] shrink-0 gap-4">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-xs">
            {currentFile
              ? (typeof currentFile === 'string' ? 'Edited Document' : currentFile.name)
              : 'No file loaded — open a PDF to begin'}
          </span>
          {isLiveBaking && (
            <span className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-semibold shrink-0">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Processing…
            </span>
          )}
          {isAnalyzing && !isLiveBaking && (
            <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-semibold shrink-0">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Analyzing document…
            </span>
          )}

          {/* Global format toolbar — operates on the active CanvasInlineEditor */}
          <div className="flex-1 flex justify-center">
            <GlobalFormatToolbar />
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={() => !isLiveBaking && setScale(s => Math.max(0.4, s - 0.25))}
              disabled={isLiveBaking}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-800 dark:text-slate-100 text-sm font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition-all shadow-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom out"
            >−</button>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 min-w-[44px] text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => !isLiveBaking && setScale(s => s + 0.25)}
              disabled={isLiveBaking}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-800 dark:text-slate-100 text-sm font-bold hover:bg-slate-200 dark:hover:bg-neutral-700 transition-all shadow-xs flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              title="Zoom in"
            >+</button>

            {/* Done — bakes all staged edits at once */}
            <button
              onClick={() => bakeAllRef.current?.()}
              disabled={!hasStaged || isLiveBaking}
              className={`ml-1 px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all ${
                hasStaged && !isLiveBaking
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95 cursor-pointer'
                  : 'bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 shadow-none cursor-not-allowed'
              }`}
              title="Bake all staged paragraph edits"
            >
              ✓ Done
            </button>

            <button
              onClick={handleFinishAndExport}
              disabled={!currentFile}
              className={`ml-1 px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                currentFile
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md active:scale-95 cursor-pointer'
                  : 'bg-slate-100 dark:bg-neutral-800 border border-slate-300 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 shadow-none cursor-not-allowed'
              }`}
            >
              ✓ Finish &amp; Export
            </button>
          </div>
        </div>

        {/* PDF Canvas */}
        <div className="flex-1 overflow-hidden relative">
          <PDFErrorBoundary>
          <PDFViewer
              file={viewerFile}
              scale={scale}
              annotations={annotations}
              canvasAnnotations={canvasAnnotations}
              spacingData={spacingData}
              onUpdateAnnotation={updateAnnotation}
              onDeleteAnnotation={deleteAnnotation}
              onCanvasClick={handleCanvasClick}
              isWandActive={isWandActive}
              onUpload={handleUpload}
              activeTool={activeTool}
              toolSettings={toolSettings}
              onAddCanvasAnnotation={addCanvasAnnotation}
              onDeleteCanvasAnnotation={deleteCanvasAnnotation}
              onBakeAllReady={(fn) => { bakeAllRef.current = fn; }}
              currentSourceFile={currentFile}
              onDocumentSwap={handleDocumentSwap}
              onBakePhaseChange={(phase) => setIsLiveBaking(phase !== 'idle')}
            />
          </PDFErrorBoundary>
        </div>
      </div>

      {/* Right Settings Panel */}
      <RightPanel
        activeTool={activeTool}
        toolSettings={toolSettings}
        onUpdateSettings={(patch) => setToolSettings(prev => ({ ...prev, ...patch }))}
        canvasAnnotations={canvasAnnotations}
        onDeleteCanvasAnnotation={deleteCanvasAnnotation}
        onFinishAndExport={handleFinishAndExport}
        hasFile={!!currentFile}
      />

      {/* Font Fallback Warnings Toast */}
      {fontWarnings.length > 0 && (
        <div className="absolute bottom-6 right-64 z-[300] flex flex-col gap-3 max-w-sm w-full">
          {fontWarnings.map((warn, idx) => (
            <div key={idx} className="bg-amber-50 border-l-4 border-amber-500 shadow-xl rounded-r-lg p-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <h3 className="text-amber-800 font-semibold text-sm">Font Fallback Used (Page {warn.pageNum})</h3>
                  <p className="text-amber-700 text-xs mt-1.5 leading-relaxed">{warn.reason}</p>
                  {warn.missingGlyphs && warn.missingGlyphs.length > 0 && (
                    <p className="text-amber-600 font-mono text-[10px] mt-2 bg-amber-100/50 p-1 rounded">
                      Missing: {warn.missingGlyphs.join(', ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setFontWarnings(prev => prev.filter((_, i) => i !== idx))}
                  className="text-amber-400 hover:text-amber-700 transition-colors shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
