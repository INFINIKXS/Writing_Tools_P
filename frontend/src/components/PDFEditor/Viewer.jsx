import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { TextOverlay } from './TextOverlay';
import { CanvasInlineEditor } from './CanvasInlineEditor';
import { DebugOverlay } from './DebugOverlay';
import { useSyncExternalStore } from 'react';
import { pdfEditStore, activeFileId } from '../../stores/pdfEditStore';
import { pdfTypographyStore } from '../../stores/pdfTypographyStore';
import { loadPDFFonts } from '../../utils/pdfFontLoader';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * Groups adjacent TextItems into single logical line-items.
 *
 * After redaction + re-insertion, a single original sentence-line becomes
 * multiple TextItems because each insert_text() call creates a separate
 * content stream object. PDF.js getTextContent() then returns one TextItem
 * per content stream object instead of one per visual line.
 *
 * This post-processing step merges items that share the same baseline,
 * same font, and are horizontally adjacent (gap < fontSize * 0.5).
 *
 * Adapted from the community algorithm in mozilla/pdf.js#10154:
 *   - Group by Y (baseline), sort by X within each group
 *   - Merge when (next.x - (current.x + current.width)) < delta
 *
 * Also informed by pdf-text-reader (npm) which inserts spaces when
 * distance-between-text exceeds a font-proportional threshold.
 */
// ── Median helper for word-boundary detection ──
function getMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Group per-character rawdict data into words using inter-character gaps.
 * A gap > 2.5× the median gap on the line signals a word boundary.
 */
function groupCharsIntoWords(lineData) {
  const { chars, gaps } = lineData;
  if (!chars || chars.length === 0) return [];

  const medianGap = gaps.length > 0 ? getMedian(gaps) : 0;
  const wordBoundaryThreshold = Math.max(medianGap * 2.5, 1.0);

  const words = [];
  let currentWord = [];

  if (chars[0].c !== ' ' && chars[0].c !== '\u00A0') {
    currentWord.push(chars[0]);
  }

  for (let i = 0; i < gaps.length; i++) {
    const isBoundary =
      gaps[i] > wordBoundaryThreshold ||
      chars[i + 1].c === ' ' ||
      chars[i + 1].c === '\u00A0';
    if (isBoundary && currentWord.length > 0) {
      words.push(currentWord);
      currentWord = [];
    }
    if (chars[i + 1].c !== ' ' && chars[i + 1].c !== '\u00A0') {
      currentWord.push(chars[i + 1]);
    }
  }

  if (currentWord.length > 0) words.push(currentWord);
  return words;
}

// Drag component strictly bound to page coordinates
function DraggableElement({ annotation, onUpdate, onDelete, scale }) {
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const displayX = annotation.x * scale;
  const displayY = annotation.y * scale;

  const handlePointerDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    setOffset({
      x: e.clientX - displayX,
      y: e.clientY - displayY
    });
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const newX = (e.clientX - offset.x) / scale;
    const newY = (e.clientY - offset.y) / scale;
    onUpdate({ ...annotation, x: newX, y: newY });
  };

  const handlePointerUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, offset, scale]);

  return (
    <div
      style={{
        position: 'absolute',
        top: Math.max(0, displayY),
        left: Math.max(0, displayX),
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 50,
      }}
      onPointerDown={handlePointerDown}
      className={`rounded min-w-[30px] ${annotation.isEditing ? 'ring-2 ring-blue-500 bg-blue-50/20' : 'hover:ring-2 hover:ring-blue-300'}`}
      onClick={(e) => { e.stopPropagation(); onUpdate({ ...annotation, isEditing: true }); }}
    >
      {annotation.isEditing && annotation.type !== 'redact' && (
        <div
          className="absolute -top-[44px] left-0 flex items-center bg-white border border-gray-200 shadow-lg rounded-md px-2 py-1.5 gap-2 z-[60]"
          onPointerDown={e => e.stopPropagation()}
        >
          <select
            value={annotation.font || "Helvetica"}
            onChange={e => onUpdate({ ...annotation, font: e.target.value })}
            className="text-xs rounded border-gray-300 bg-gray-50 py-0.5 px-1 cursor-pointer outline-none"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Times-Roman">Times Roman</option>
            <option value="Courier">Courier</option>
          </select>
          <div className="w-px h-4 bg-gray-300" />
          <input
            type="number"
            value={annotation.size || 16}
            onChange={e => onUpdate({ ...annotation, size: Number(e.target.value) })}
            className="w-12 text-xs rounded border-gray-300 px-1 py-0.5 outline-none font-mono"
            min="1" max="100"
          />
        </div>
      )}

      {annotation.type === 'redact' ? (
        <div
          style={{
            width: (annotation.width || 100) * scale,
            height: (annotation.height || 20) * scale,
            resize: 'both',
            overflow: 'hidden',
            backgroundColor: 'white',
            border: annotation.isEditing ? '1px solid #ccc' : 'none'
          }}
          onPointerUp={(e) => {
            if (e.target.offsetWidth) {
              const rectWidth = e.target.offsetWidth / scale;
              const rectHeight = e.target.offsetHeight / scale;
              if (rectWidth !== annotation.width || rectHeight !== annotation.height) {
                onUpdate({ ...annotation, width: rectWidth, height: rectHeight });
              }
            }
          }}
        />
      ) : (
        <>
          {annotation.isEditing ? (
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={() => onUpdate({ ...annotation, isEditing: false })}
              onInput={(e) => onUpdate({ ...annotation, text: e.currentTarget.textContent })}
              style={{ 
                display: 'block',
                fontSize: `${(annotation.size || 16) * scale}px`, 
                fontFamily: annotation.font || 'sans-serif', 
                minWidth: '2ch',
                outline: 'none',
                whiteSpace: 'pre',
                // -- Box Model Fixes --
                lineHeight: 1, 
                padding: 0,
                margin: 0,
                textDecoration: 'underline',
                textDecorationStyle: 'dashed',
                textDecorationColor: '#60a5fa',
                textUnderlineOffset: '4px'
              }}
            >
              {annotation.text || ""}
            </span>
          ) : (
            <div 
              style={{ 
                fontSize: `${(annotation.size || 16) * scale}px`, 
                fontFamily: annotation.font || 'sans-serif', 
                whiteSpace: 'nowrap',
                // -- Box Model Fixes --
                lineHeight: 1, // Crucial: Prevents default 1.2 line-height from pushing text down
                padding: 0,
                margin: 0
              }} 
              className="text-gray-900 select-none tabular-nums"
            >
              {annotation.text || "Empty"}
            </div>
          )}
        </>
      )}

      {annotation.isEditing && (
        <button
          onPointerDown={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 shadow-md"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function PDFViewer({
  file, scale = 1.0,
  annotations = [], canvasAnnotations = [],
  spacingData = null,
  onUpdateAnnotation, onDeleteAnnotation,
  onCanvasClick, isWandActive, onLivePreview,
  onUpload,
  // New tool props
  activeTool = 'select',
  toolSettings = {},
  onAddCanvasAnnotation,
  onDeleteCanvasAnnotation,
}) {
  const [numPages, setNumPages] = useState(null);
  // Drawing state for canvas annotation tools
  const [drawingState, setDrawingState] = useState(null);
  // drawingState shape: { tool, startX, startY, currentX, currentY, path:[{x,y}], pageIndex }

  // ─── Dual-document pattern (eliminates the white-flash on bake) ─────────────
  // When a new `file` prop arrives we keep the previous document rendered as
  // a fully-opaque backdrop while the new one loads invisibly underneath it.
  // Once the new document fires onLoadSuccess we hide the backdrop.
  // This means there is never a moment of blank canvas for the user.
  const [previousFile, setPreviousFile] = useState(null);
  const [isNewDocLoading, setIsNewDocLoading] = useState(false);
  // Separate page count for the backdrop so it renders the right number of pages
  const [previousNumPages, setPreviousNumPages] = useState(null);
  // Track whether custom PDF fonts have been loaded and rendered by the browser
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const extractedFontsRef = useRef(false);

  // Developer Debug Mode (Ctrl+Shift+D)
  const [debugMode, setDebugMode] = useState(false);
  const [debugFontWeightCompare, setDebugFontWeightCompare] = useState(false);
  // Dynamic block vertical cascade shift state
  const [activeBlockShift, setActiveBlockShift] = useState(null);

  const [fileGeneration, setFileGeneration] = useState(0);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    // When the file prop changes (new bake arrived), start the loading transition.
    // Guard against the very first load where previousFile is still null.
    if (file && file !== previousFile) {
      if (previousFile !== null) {
        setIsNewDocLoading(true);
      }
    }
  // previousFile is intentionally NOT in the dep array — we only want to fire
  // when `file` changes, and we read previousFile as a live ref via the callback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Fetch embedded fonts when a new PDF loads
  useEffect(() => {
    if (!file) {
      extractedFontsRef.current = false;
      return;
    }
    
    if (extractedFontsRef.current) return;

    let isCancelled = false;
    setFontsLoaded(false);

    const extractFonts = async () => {
      try {
        extractedFontsRef.current = true;
        let fileBlob = null;
        if (file instanceof Blob) {
          fileBlob = file;
        } else if (typeof file === 'string') {
          const res = await fetch(file);
          if (!res.ok) throw new Error(`Failed to fetch PDF from URL for font extraction: ${res.status}`);
          fileBlob = await res.blob();
        } else if (file instanceof ArrayBuffer) {
          fileBlob = new Blob([file], { type: 'application/pdf' });
        } else if (file && file.data) {
          fileBlob = new Blob([file.data], { type: 'application/pdf' });
        } else if (file) {
          fileBlob = new Blob([file], { type: 'application/pdf' });
        }

        if (!fileBlob || !(fileBlob instanceof Blob)) {
          throw new Error('Invalid file format for font extraction');
        }

        if (isCancelled) return;

        const form = new FormData();
        form.append('file', fileBlob, fileBlob.name || 'document.pdf');

        const response = await fetch('/api/pdf/extract-fonts', { method: 'POST', body: form });
        const fontsData = response.ok ? await response.json() : {};

        if (isCancelled) return;

        if (fontsData && Object.keys(fontsData).length > 0) {
          await loadPDFFonts(fontsData);
          await document.fonts.ready;
        }
      } catch (e) {
        console.warn('font extraction failed:', e);
      } finally {
        if (!isCancelled) {
          setFontsLoaded(true);
        }
      }
    };

    extractFonts();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  const [pageMetadata, setPageMetadata] = useState({});
  const [selectedTextIdx, setSelectedTextIdx] = useState(null);
  const [activePageNum, setActivePageNum] = useState(null);

  // Refs to page container divs — needed for DOM color sampling and span measurement
  const pageContainerRefs = useRef({});

  // FIX: Use a ref (not state) to track which pages have been extracted.
  // State-based guards suffer from stale closures inside onLoadSuccess callbacks —
  // the callback captures the pageMetadata value from the render it was created in,
  // not the current value. A ref is always current regardless of render timing.
  const pageItemsExtracted = useRef({});

  // Extract items for each page when spacingData is available.
  // This runs whenever spacingData changes (first load, or after a bake)
  // OR when a page reports its size via onLoadSuccess.
  // Only pages that have a known size AND haven't been extracted yet will
  // be processed, so this naturally handles all timing scenarios:
  //   - spacingData arrives before pages load: waits for sizes, then extracts
  //   - pages load before spacingData arrives: waits for spacingData, then extracts
  //   - both already ready (zoom change, etc.): skipped due to extraction guard
  useEffect(() => {
    if (!spacingData) return;

    Object.entries(pageMetadata).forEach(([pageNumStr, meta]) => {
      const pageNum = parseInt(pageNumStr);
      const index = pageNum - 1;
      if (!meta?.size) return;
      if (pageItemsExtracted.current[pageNum]) return;

      const pageData = spacingData.find((p) => p.page === index);
      if (!pageData || !pageData.blocks) return;

      pageItemsExtracted.current[pageNum] = true;

      // ── Step 1: Build one item per line AND index words by baseline ──
      const lineItems = [];
      const allWordsByBaseline = {};

      pageData.blocks.forEach((blockData) => {
        if (!blockData.lines) return;
        blockData.lines.forEach((lineData) => {
          const words = groupCharsIntoWords(lineData);
          if (words.length === 0) return;

          const baselineKey = Math.round(words[0][0].origin_y * 2) / 2;
          if (!allWordsByBaseline[baselineKey]) allWordsByBaseline[baselineKey] = [];
          words.forEach((w) => allWordsByBaseline[baselineKey].push(w));

          const allCharsInLine = words.flat();

          // Detect dominant baseline + font size to classify super/sub.
          const baselineCounts = {};
          for (const ch of allCharsInLine) {
            const key = Math.round(ch.origin_y * 2) / 2;
            baselineCounts[key] = (baselineCounts[key] || 0) + 1;
          }
          let dominantBaseline = allCharsInLine[0].origin_y;
          let maxCount = 0;
          for (const [key, count] of Object.entries(baselineCounts)) {
            if (count > maxCount) {
              maxCount = count;
              dominantBaseline = parseFloat(key);
            }
          }
          const sizeCounts = {};
          for (const ch of allCharsInLine) {
            const key = Math.round(ch.size * 2) / 2;
            sizeCounts[key] = (sizeCounts[key] || 0) + 1;
          }
          let dominantSize = allCharsInLine[0].size;
          let maxSizeCount = 0;
          for (const [key, count] of Object.entries(sizeCounts)) {
            if (count > maxSizeCount) {
              maxSizeCount = count;
              dominantSize = parseFloat(key);
            }
          }
          const SUB_BASELINE_THRESHOLD = dominantSize * 0.15;

          // Build lineStr INCLUDING all super/sub chars inline. Track which
          // char indices are super vs sub so the InlineEditor can render
          // them as <sup>/<sub> elements.
          let lineStr = '';
          const charKinds = []; // per char in lineStr: 'normal' | 'super' | 'sub'
          const charColors = []; // parallel: per-char color string
          words.forEach((wordChars, wi) => {
            if (wi > 0) {
              lineStr += ' ';
              charKinds.push('normal');
              // For injected separator space, borrow the previous word's last color
              charColors.push(
                wordChars[0]?.color || charColors[charColors.length - 1] || 'rgb(0, 0, 0)'
              );
            }
            for (const ch of wordChars) {
              lineStr += ch.c;
              if (ch.is_superscript) {
                charKinds.push('super');
              } else if (
                ch.is_subscript === true ||
                (ch.is_subscript == null &&
                  ch.origin_y > dominantBaseline + SUB_BASELINE_THRESHOLD &&
                  ch.size < dominantSize - 0.5)
              ) {
                charKinds.push('sub');
              } else {
                charKinds.push('normal');
              }
              charColors.push(ch.color || 'rgb(0, 0, 0)');
            }
          });

          // Collapse charKinds into contiguous ranges
          const superscriptRanges = [];
          let runStart = -1;
          let runKind = null;
          for (let i = 0; i <= charKinds.length; i++) {
            const k = i < charKinds.length ? charKinds[i] : 'normal';
            if (k === runKind) continue;
            if (runStart !== -1 && runKind !== 'normal') {
              superscriptRanges.push({
                kind: runKind,
                charStart: runStart,
                charEnd: i,
                color: charColors[runStart] || 'rgb(0, 0, 0)',
              });
            }
            if (k !== 'normal') {
              runStart = i;
              runKind = k;
            } else {
              runStart = -1;
              runKind = null;
            }
          }

          // Bounding box: enclose ALL chars (including super/sub raised
          // above or dropped below the dominant baseline).
          const lineX0 = Math.min(...allCharsInLine.map((c) => c.x0));
          const lineX1 = Math.max(...allCharsInLine.map((c) => c.x1));
          const lineY_base = dominantBaseline;
          const lineY_top = Math.min(...allCharsInLine.map((c) => c.y0));
          const lineY_bottom = Math.max(...allCharsInLine.map((c) => c.y1));
          const lineH = lineY_bottom - lineY_top;
          const lineFontSize = dominantSize;
          const lineFontName = allCharsInLine[0].font;
          const ascenderH = Math.max(0, lineY_base - lineY_top);
          const descenderH = Math.max(0, lineY_bottom - lineY_base);

          // Right-trim trailing whitespace from lineStr so the editable text
          // doesn't appear to have room for more characters than the bounding
          // box actually covers. The parallel charKinds/charColors arrays have
          // already been consumed for superscriptRanges above, so we only need
          // to trim lineStr itself.
          lineStr = lineStr.replace(/\s+$/, '');

          const hasSuperscript = superscriptRanges.length > 0;

          lineItems.push({
            str: lineStr,
            pdfX: lineX0,
            pdfY_base: lineY_base,
            pdfY_top: lineY_top,
            pdfW: lineX1 - lineX0,
            pdfH: lineH,
            fontSize: lineFontSize,
            fontName: lineFontName,
            hasSuperscript,
            superscriptRanges,
            ascender_h: ascenderH,
            descender_h: descenderH,
            color: lineData.dominant_color || 'rgb(0, 0, 0)',
            _baselineKey: baselineKey,
            // Authoritative style info from backend PyMuPDF font flags.
            // These override PDF.js's text-layer heuristics which can
            // misreport bold/italic for subsetted embedded fonts.
            isBold: lineData.is_bold === true,
            isItalic: lineData.is_italic === true,
            fontPostScriptName: lineData.dominant_font || lineFontName,
            chars: lineData.chars || allCharsInLine,
            line_x0: lineData.line_x0 !== undefined ? lineData.line_x0 : lineX0,
            line_x1: lineData.line_x1 !== undefined ? lineData.line_x1 : lineX1,
            line_y0: lineData.line_y0 !== undefined ? lineData.line_y0 : lineY_top,
            line_y1: lineData.line_y1 !== undefined ? lineData.line_y1 : lineY_bottom,
            width: lineData.width !== undefined ? lineData.width : (lineX1 - lineX0),
            space_count: lineData.space_count !== undefined ? lineData.space_count : (lineStr.match(/ /g) || []).length,
          });
        });
      });

      // ── Step 2: Find baselines that need regrouping ──
      const blockCountPerBaseline = {};
      pageData.blocks.forEach((blockData, bi) => {
        if (!blockData.lines) return;
        blockData.lines.forEach((lineData) => {
          const words = groupCharsIntoWords(lineData);
          if (words.length === 0) return;
          const baselineKey = Math.round(words[0][0].origin_y * 2) / 2;
          if (!blockCountPerBaseline[baselineKey]) blockCountPerBaseline[baselineKey] = new Set();
          blockCountPerBaseline[baselineKey].add(bi);
        });
      });

      const baselinesNeedingRegroup = new Set();
      for (const [baseline, blockSet] of Object.entries(blockCountPerBaseline)) {
        if (blockSet.size > 1) baselinesNeedingRegroup.add(parseFloat(baseline));
      }

      // ── Step 3: Column index helper ──
      const columns = pageData.columns || null;
      const getColumnIndex = (x) => {
        if (!columns || columns.length <= 1) return 0;
        const splitX = (columns[0][1] + columns[1][0]) / 2;
        return x < splitX ? 0 : 1;
      };

      // ── Step 4: Start with ALL line items from untouched baselines ──
      const finalItems = [];
      for (const li of lineItems) {
        if (baselinesNeedingRegroup.has(li._baselineKey)) continue;
        finalItems.push(li);
      }

      // ── Step 5: Regroup only the affected baselines ──
      for (const baseline of baselinesNeedingRegroup) {
        const wordsOnLine = allWordsByBaseline[baseline] || [];
        if (wordsOnLine.length === 0) continue;
        wordsOnLine.sort((a, b) => a[0].x0 - b[0].x0);

        let currentItem = null;
        let currentCol = -1;

        for (const wordChars of wordsOnLine) {
          const wordStr = wordChars.map((c) => c.c).join('');
          const wordX0 = wordChars[0].x0;
          const wordY_base = wordChars[0].origin_y;
          const wordY_top = Math.min(...wordChars.map((c) => c.y0));
          const wordW = wordChars[wordChars.length - 1].x1 - wordChars[0].x0;
          const wordH = Math.max(...wordChars.map((c) => c.y1 - c.y0));
          const wordFontSize = wordChars[0].size;
          const wordFontName = wordChars[0].font;
          let wordHasSuperscript = false;
          for (const ch of wordChars) {
            if (ch.is_superscript) wordHasSuperscript = true;
          }
          const ascenderH = Math.max(0, wordY_base - wordY_top);
          const descenderH = Math.max(0, wordY_top + wordH - wordY_base);
          const wordCol = getColumnIndex(wordX0);

          if (!currentItem) {
            currentItem = {
              str: wordStr, pdfX: wordX0, pdfY_base: wordY_base, pdfY_top: wordY_top,
              pdfW: wordW, pdfH: wordH, fontSize: wordFontSize, fontName: wordFontName,
              hasSuperscript: wordHasSuperscript, ascender_h: ascenderH, descender_h: descenderH,
              color: wordChars[0].color || 'rgb(0, 0, 0)',
              chars: [...wordChars],
              line_x0: wordX0,
              line_x1: wordX0 + wordW,
              line_y0: wordY_top,
              line_y1: wordY_top + wordH,
              width: wordW,
              space_count: (wordStr.match(/ /g) || []).length,
            };
            currentCol = wordCol;
          } else {
            const sameColumn = wordCol === currentCol;
            const gap = wordX0 - (currentItem.pdfX + currentItem.pdfW);
            if (sameColumn && gap <= currentItem.fontSize * 1.5) {
              const needsSpace = gap > currentItem.fontSize * 0.12;
              currentItem.str += (needsSpace ? ' ' : '') + wordStr;
              currentItem.pdfW = wordX0 + wordW - currentItem.pdfX;
              currentItem.pdfH = Math.max(currentItem.pdfH, wordH);
              currentItem.pdfY_top = Math.min(currentItem.pdfY_top, wordY_top);
              if (wordHasSuperscript) currentItem.hasSuperscript = true;
              if (ascenderH > currentItem.ascender_h) currentItem.ascender_h = ascenderH;
              if (descenderH > currentItem.descender_h) currentItem.descender_h = descenderH;
              if (currentItem.chars) currentItem.chars.push(...wordChars);
              currentItem.line_x0 = currentItem.pdfX;
              currentItem.line_x1 = currentItem.pdfX + currentItem.pdfW;
              currentItem.line_y0 = currentItem.pdfY_top;
              currentItem.line_y1 = currentItem.pdfY_top + currentItem.pdfH;
              currentItem.width = currentItem.pdfW;
              currentItem.space_count = (currentItem.str.match(/ /g) || []).length;
            } else {
              finalItems.push(currentItem);
              currentItem = {
                str: wordStr, pdfX: wordX0, pdfY_base: wordY_base, pdfY_top: wordY_top,
                pdfW: wordW, pdfH: wordH, fontSize: wordFontSize, fontName: wordFontName,
                hasSuperscript: wordHasSuperscript, ascender_h: ascenderH, descender_h: descenderH,
                color: wordChars[0].color || 'rgb(0, 0, 0)',
                chars: [...wordChars],
                line_x0: wordX0,
                line_x1: wordX0 + wordW,
                line_y0: wordY_top,
                line_y1: wordY_top + wordH,
                width: wordW,
                space_count: (wordStr.match(/ /g) || []).length,
              };
              currentCol = wordCol;
            }
          }
        }
        if (currentItem) finalItems.push(currentItem);
      }

      // ── Step 6: Map PyMuPDF blocks authoritatively to Paragraph-Block items ──
      const paragraphItems = [];

      pageData.blocks.forEach((blockData) => {
        if (!blockData.lines || blockData.lines.length === 0) return;

        // Collect matching line items from finalItems for this PyMuPDF block
        const blockLines = [];
        blockData.lines.forEach((lData) => {
          const lY = lData.line_y0;
          const lX = lData.line_x0;
          // Try strict 2D match first (column-aware), then fallback to y-only for indented first lines
          let match = finalItems.find(
            (fi) => Math.abs(fi.pdfY_top - lY) < 3.5 && Math.abs(fi.pdfX - lX) < 40.0
          );
          if (!match) {
            match = finalItems.find((fi) => Math.abs(fi.pdfY_top - lY) < 3.5);
          }
          if (match && !blockLines.includes(match)) {
            blockLines.push(match);
          }
        });

        if (blockLines.length > 1) {
          // ── Fix 2: Split on font-family or font-size boundaries ──────────
          // Never merge a heading (e.g. bold condensed 12pt) with body text
          // (regular serif 10pt) into the same editable block. Compare the
          // root family name (strip subset prefix + weight/style suffixes) and
          // the rounded font size. Start a fresh sub-group whenever either
          // changes significantly.
          const rootFamily = (name) =>
            (name || '')
              .replace(/^[A-Z]{6}\+/, '')          // strip subset tag e.g. NBUDXT+
              .replace(/[-_](Bold|Italic|Oblique|Regular|Roman|Light|Medium|Thin|Black|Heavy|Cond(?:ensed)?|Ext(?:ended)?|Narrow)/gi, '')
              .toLowerCase()
              .trim();

          const subGroups = [];
          let currentGroup = [blockLines[0]];
          for (let gi = 1; gi < blockLines.length; gi++) {
            const prev = blockLines[gi - 1];
            const curr = blockLines[gi];
            const prevFamily = rootFamily(prev.fontName);
            const currFamily = rootFamily(curr.fontName);
            // Font-size difference > 1.5pt = different style tier
            const sizeDiffers = Math.abs((prev.fontSize || 0) - (curr.fontSize || 0)) > 1.5;
            // Different root family = different typeface entirely
            const familyDiffers = prevFamily && currFamily && prevFamily !== currFamily;
            if (sizeDiffers || familyDiffers) {
              subGroups.push(currentGroup);
              currentGroup = [curr];
            } else {
              currentGroup.push(curr);
            }
          }
          subGroups.push(currentGroup);


          // ── Process each font-homogeneous sub-group as its own paragraph ──
          // Sort every sub-group top-to-bottom before processing
          subGroups.forEach((sgLines) => {
            sgLines.sort((a, b) => Math.abs(a.pdfY_top - b.pdfY_top) > 2.0 ? a.pdfY_top - b.pdfY_top : a.pdfX - b.pdfX);

            if (sgLines.length === 1) {
              // Single-line sub-group: emit as a plain (non-paragraph) item
              paragraphItems.push({
                ...sgLines[0],
                origLines: sgLines,
              });
              return;
            }

            // Multi-line sub-group: build a unified paragraph item
            const colorCounts = {};
            sgLines.forEach((l) => {
              const c = l.color || 'rgb(0, 0, 0)';
              colorCounts[c] = (colorCounts[c] || 0) + 1;
            });
            const dominantColor = Object.keys(colorCounts).reduce((a, b) =>
              colorCounts[a] > colorCounts[b] ? a : b
            );

            // Use PyMuPDF line bbox coordinates (line_x0/line_x1) for block bounds.
            // This makes r.w consistent with targetWidth in CanvasInlineEditor,
            // preventing text from overflowing and being clipped at the right edge.
            const pX0 = Math.min(...sgLines.map((l) => l.line_x0 ?? l.pdfX));
            const pX1 = Math.max(...sgLines.map((l) => l.line_x1 ?? (l.pdfX + l.pdfW)));
            const pY0 = Math.min(...sgLines.map((l) => l.pdfY_top));
            const pY1 = Math.max(...sgLines.map((l) => l.pdfY_top + l.pdfH));

            const blockAlign = blockData.align || 'left';

            // Build unified string pStr and track exact inter-line separators
            // Fix 1: Use '\n' as separator for justified paragraphs too, so hard
            // line-breaks from PyMuPDF are preserved and CSS pre-wrap honours them.
            let pStr = '';
            const lineSeps = [];
            sgLines.forEach((l, i) => {
              if (i === 0) {
                pStr = l.str;
              } else {
                // Always use '\n' as the line separator so the Canvas layout engine
                // can map each \n-block 1:1 to the correct PyMuPDF origLine for
                // coordinate-driven startX and targetWidth lookups.
                // Hyphenated line-endings get no separator (word continues on next line).
                const sep = pStr.endsWith('-') ? '' : '\n';
                lineSeps.push(sep);
                pStr += sep + l.str;
              }
            });

            // Accumulate superscript / subscript ranges with char-offset alignment
            const pSuperscriptRanges = [];
            let charOffset = 0;
            sgLines.forEach((l, i) => {
              if (l.superscriptRanges && l.superscriptRanges.length > 0) {
                l.superscriptRanges.forEach((r) => {
                  pSuperscriptRanges.push({
                    ...r,
                    charStart: charOffset + r.charStart,
                    charEnd: charOffset + r.charEnd,
                  });
                });
              }
              if (i < sgLines.length - 1) {
                const sep = lineSeps[i] !== undefined ? lineSeps[i] : (pStr.endsWith('-') ? '' : (blockAlign === 'justify' ? ' ' : '\n'));
                charOffset += l.str.length + sep.length;
              }
            });

            // Dominant font size
            const sizeCounts = {};
            sgLines.forEach((l) => {
              const s = Math.round(l.fontSize * 10) / 10;
              sizeCounts[s] = (sizeCounts[s] || 0) + 1;
            });
            const dominantFontSize = parseFloat(
              Object.keys(sizeCounts).reduce((a, b) => (sizeCounts[a] > sizeCounts[b] ? a : b))
            );

            // Baseline pitch for pixel-perfect CSS line-height
            let linePitch;
            if (sgLines.length > 1) {
              const firstBase = sgLines[0].pdfY_base;
              const lastBase = sgLines[sgLines.length - 1].pdfY_base;
              linePitch = (lastBase - firstBase) / (sgLines.length - 1);
            } else {
              linePitch = sgLines[0].pdfH;
            }

            // Use line_x0 for indent calculation (consistent with pX0 above)
            const firstLineIndent = (sgLines[0].line_x0 ?? sgLines[0].pdfX) - pX0;
            const textIndentPdf = firstLineIndent > 1.0 ? firstLineIndent : 0;

            const pFontFamily = blockData.font_family || sgLines[0].fontName || 'Helvetica';
            const pFontSize = blockData.font_size || dominantFontSize;
            const pColor = blockData.hex_color || blockData.font_color || dominantColor;
            const pAlign = blockData.align || 'left';
            const pId = blockData.paragraph_id || `p_${index}_${blockData.block_number || paragraphItems.length}`;

            paragraphItems.push({
              str: pStr,
              lines: sgLines.map(l => ({ text: l.str, width: l.pdfW })),
              rawPdfLines: sgLines.map(l => l.str),
              pdfX: pX0,
              pdfY_base: sgLines[0].pdfY_base,
              pdfY_top: pY0,
              pdfW: pX1 - pX0,
              pdfH: pY1 - pY0,
              fontSize: dominantFontSize,
              fontName: sgLines[0].fontName,
              color: dominantColor,
              isBold: sgLines[0].isBold,
              isItalic: sgLines[0].isItalic,
              isParagraph: true,
              align: pAlign,
              lineCount: sgLines.length,
              lineHeight: linePitch,
              textIndent: textIndentPdf,
              hasSuperscript: pSuperscriptRanges.length > 0,
              superscriptRanges: pSuperscriptRanges,
              origLines: sgLines,
              paragraph_id: pId,
              paragraph_font_size: pFontSize,
              paragraph_font_family: pFontFamily,
              paragraph_color: pColor,
              paragraph_align: pAlign,
              paragraph_text: pStr,
              paragraphTypography: {
                font_size: pFontSize,
                font_family: pFontFamily,
                color: pColor,
                align: pAlign,
                paragraph_id: pId,
                text: pStr,
              },
            });
          });
        } else if (blockLines.length === 1) {
          const l0 = blockLines[0];
          const pFontFamily = blockData.font_family || l0.fontName || 'Helvetica';
          const pFontSize = blockData.font_size || l0.fontSize;
          const pColor = blockData.hex_color || blockData.font_color || l0.color;
          const pAlign = blockData.align || 'left';
          const pId = blockData.paragraph_id || `p_${index}_${blockData.block_number || paragraphItems.length}`;

          paragraphItems.push({
            ...l0,
            origLines: blockLines,
            paragraph_id: pId,
            paragraph_font_size: pFontSize,
            paragraph_font_family: pFontFamily,
            paragraph_color: pColor,
            paragraph_align: pAlign,
            paragraph_text: l0.str || l0.text || '',
            paragraphTypography: {
              font_size: pFontSize,
              font_family: pFontFamily,
              color: pColor,
              align: pAlign,
              paragraph_id: pId,
              text: l0.str || l0.text || '',
            },
          });
        }
      });

      const displayItems = paragraphItems.length > 0 ? paragraphItems : finalItems;
      displayItems.sort((a, b) => {
        const yDiff = a.pdfY_base - b.pdfY_base;
        if (Math.abs(yDiff) > 1.5) return yDiff;
        return a.pdfX - b.pdfX;
      });

      setPageMetadata((prev) => ({
        ...prev,
        [pageNum]: { ...prev[pageNum], items: displayItems },
      }));
    });
  }, [spacingData, pageMetadata]);

  const edits = useSyncExternalStore(pdfEditStore.subscribe, () => pdfEditStore.getEdits(activeFileId));
  const _typographyData = useSyncExternalStore(pdfTypographyStore.subscribe, () => pdfTypographyStore.getTypographyData(activeFileId));

  // ─── Color sampling + span width measurement useEffect ────────────────────
  // This runs AFTER render, so the canvas and text layer spans are guaranteed
  // to exist in the DOM. It sets _colorsApplied=true so it only runs once per
  // page load (cleared on zoom change by onLoadSuccess).
  useEffect(() => {
    Object.entries(pageMetadata).forEach(([pageNumStr, meta]) => {
      if (!meta?.items || meta._colorsApplied) return;
      const pageNum = parseInt(pageNumStr);
      const container = pageContainerRefs.current[pageNum];
      if (!container) return;
      const canvas = container.querySelector('canvas');
      if (!canvas) return;

      let ctx = null;
      try { ctx = canvas.getContext('2d', { willReadFrequently: true }); } catch { /* ignore */ }
      if (!ctx) return;

      const currentScale = scale;

      // Collect pdfjs text spans from the DOM text layer
      const textLayerDiv = container.querySelector('.react-pdf__Page__textContent');
      const allSpans = textLayerDiv ? Array.from(textLayerDiv.querySelectorAll('span')) : [];

      // Build lookup: text content → array of {span, used}
      // We mark spans as used so duplicate strings get distinct spans
      const spansByText = {};
      for (const span of allSpans) {
        const txt = span.textContent || '';
        if (!spansByText[txt]) spansByText[txt] = [];
        spansByText[txt].push({ span, used: false });
      }

      const updatedItems = meta.items.map((item) => {
        const updates = {};

        // Match this item to a pdfjs span by text content
        const candidates = spansByText[item.str];
        let matchedSpan = null;
        if (candidates) {
          const unused = candidates.find(c => !c.used);
          if (unused) {
            unused.used = true;
            matchedSpan = unused.span;
          }
        }

        if (matchedSpan) {
          const cs = window.getComputedStyle(matchedSpan);

          // FIX: Capture the actual rendered span width in PDF points.
          const spanRect = matchedSpan.getBoundingClientRect();
          const renderedW = spanRect.width / currentScale;
          if (renderedW > 0) updates.pdfW = renderedW;

          // FIX: Capture rendered font family and color.
          // DO NOT overwrite authoritative backend item.isBold/item.isItalic flags if defined.
          if (cs.fontFamily) updates.renderedFontFamily = cs.fontFamily;
          if (cs.color && cs.color !== 'rgba(0, 0, 0, 0)' && cs.color !== 'transparent') updates.color = cs.color;
          if (item.isBold === undefined) {
            if (cs.fontWeight === 'bold' || parseInt(cs.fontWeight) >= 700) updates.isBold = true;
          }
          if (item.isItalic === undefined) {
            if (cs.fontStyle === 'italic' || cs.fontStyle === 'oblique') updates.isItalic = true;
          }
        }


        return Object.keys(updates).length > 0 ? { ...item, ...updates } : item;
      });

      setPageMetadata(prev => ({
        ...prev,
        [pageNum]: { ...prev[pageNum], items: updatedItems, _colorsApplied: true }
      }));
    });
  }, [pageMetadata, scale]);

  // ─── Keyboard shortcuts (undo/redo) ──────────────────────────────────────
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDebugMode(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          pdfEditStore.redo(activeFileId);
        } else {
          pdfEditStore.undo(activeFileId);
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        pdfEditStore.redo(activeFileId);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // ─── Document load ──────────────────────────────────────────────────────────
  function onDocumentLoadSuccess({ numPages: n }) {
    const savedScrollPos = scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;

    setNumPages(n);
    
    // ALL of these must happen in the SAME React batch:
    setPageMetadata({});
    pageItemsExtracted.current = {};
    pdfEditStore.clearEdits(activeFileId);
    setFileGeneration(prev => prev + 1);  // ← SYNCHRONOUS, not in setTimeout
    
    setPreviousNumPages(n);
    setPreviousFile(file);
    setIsNewDocLoading(false);

    // Restore scroll after React commits the new DOM
    requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedScrollPos;
        }
    });
  }

  // ── Canvas-tool helper: page-relative PDF-space coords ───────────────
  const getPageCoords = (e, pageEl) => {
    const rect = pageEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const handlePagePointerDown = (e, pageIndex, pageEl) => {
    if (isWandActive) {
      e.preventDefault();
      const { x, y } = getPageCoords(e, pageEl);
      onCanvasClick(pageIndex, x, y);
      return;
    }
    const drawingTools = ['highlight', 'draw', 'shape', 'eraser', 'signature'];
    if (!drawingTools.includes(activeTool)) return;
    e.preventDefault();
    const { x, y } = getPageCoords(e, pageEl);
    setDrawingState({ tool: activeTool, startX: x, startY: y, currentX: x, currentY: y, path: [{ x, y }], pageIndex });
  };

  const handlePagePointerMove = (e, pageIndex, pageEl) => {
    if (!drawingState || drawingState.pageIndex !== pageIndex) return;
    const { x, y } = getPageCoords(e, pageEl);
    setDrawingState(prev => ({
      ...prev, currentX: x, currentY: y,
      path: [...prev.path, { x, y }],
    }));
  };

  const handlePagePointerUp = (e, pageIndex, pageEl) => {
    if (!drawingState || drawingState.pageIndex !== pageIndex) return;
    const { x, y } = getPageCoords(e, pageEl);
    const { tool, startX, startY, path } = drawingState;
    setDrawingState(null);
    if (!onAddCanvasAnnotation) return;

    if (tool === 'highlight') {
      const rx = Math.min(startX, x), ry = Math.min(startY, y);
      const rw = Math.abs(x - startX), rh = Math.abs(y - startY);
      if (rw < 5 || rh < 5) return;
      onAddCanvasAnnotation({ type: 'highlight', pageIndex, x: rx, y: ry, width: rw, height: rh, color: toolSettings.highlightColor || '#FFD700', opacity: toolSettings.opacity ?? 0.45 });
    } else if (tool === 'shape') {
      const rx = Math.min(startX, x), ry = Math.min(startY, y);
      const rw = Math.abs(x - startX), rh = Math.abs(y - startY);
      if (rw < 5 || rh < 5) return;
      onAddCanvasAnnotation({ type: 'shape', pageIndex, x: rx, y: ry, width: rw, height: rh, shapeType: toolSettings.shapeType || 'rect', strokeColor: toolSettings.color || '#000000', fillColor: toolSettings.fillColor || null, strokeWidth: toolSettings.strokeWidth || 2, opacity: toolSettings.opacity ?? 1.0 });
    } else if (tool === 'eraser') {
      const rx = Math.min(startX, x), ry = Math.min(startY, y);
      const rw = Math.abs(x - startX), rh = Math.abs(y - startY);
      if (rw < 3 || rh < 3) return;
      onAddCanvasAnnotation({ type: 'shape', pageIndex, x: rx, y: ry, width: rw, height: rh, shapeType: 'rect', strokeColor: '#FFFFFF', fillColor: '#FFFFFF', strokeWidth: 1, opacity: 1.0 });
    } else if (tool === 'draw' || tool === 'signature') {
      if (path.length < 2) return;
      const pathData = path.map((pt, i) => ({ op: i === 0 ? 'M' : 'L', x: pt.x, y: pt.y }));
      onAddCanvasAnnotation({ type: tool === 'signature' ? 'signature' : 'freehand', pageIndex, path: pathData, color: toolSettings.color || '#000000', strokeWidth: toolSettings.strokeWidth || 2, opacity: toolSettings.opacity ?? 1.0 });
    }
  };

  const handlePageClick = (e, pageIndex, pageEl) => {
    if (activeTool === 'sticky' && onAddCanvasAnnotation) {
      const { x, y } = getPageCoords(e, pageEl);
      const text = window.prompt('Enter sticky note text:');
      if (text) {
        onAddCanvasAnnotation({ type: 'sticky_note', pageIndex, x, y, text, color: toolSettings.stickyColor || '#FFD700' });
      }
    }
  };

  const handleImageDrop = (e, pageIndex, pageEl) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const rect = pageEl.getBoundingClientRect();
    const dropX = (e.clientX - rect.left) / scale;
    const dropY = (e.clientY - rect.top) / scale;
    const reader = new FileReader();
    reader.onload = () => {
      onAddCanvasAnnotation?.({ type: 'image', pageIndex, x: dropX - 60, y: dropY - 60, width: 120, height: 120, src: reader.result });
    };
    reader.readAsDataURL(file);
  };
  if (!file) {
    return (
      <label
        htmlFor="viewer-empty-upload"
        className="flex items-center justify-center p-12 glass-card h-full w-full flex-col gap-5 text-center cursor-pointer group hover:border-purple-500/50 transition-all duration-300"
        title="Click to open a PDF"
      >
        <input
          id="viewer-empty-upload"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0] && onUpload) onUpload(e.target.files[0]); }}
        />
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-neutral-600 group-hover:border-purple-500 bg-neutral-800/50 group-hover:bg-purple-500/10 flex items-center justify-center mb-2 transition-all duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 group-hover:text-purple-400 transition-colors duration-300">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M12 18v-6"/>
            <path d="m9 15 3-3 3 3"/>
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-extrabold text-neutral-500 group-hover:text-purple-400 mb-2 transition-colors duration-300">NO PDF LOADED</h3>
          <p className="text-sm text-neutral-400 font-medium max-w-sm mx-auto">Click anywhere here to open a PDF file</p>
          <p className="text-xs text-neutral-600 mt-1">or use the upload button in the left toolbar</p>
        </div>
      </label>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex flex-col items-center overflow-auto bg-[#000000] p-8 border border-white/5 rounded-xl h-full relative"
      onClick={(e) => {
        // Do not clear selection if click originated inside an inline editor or canvas
        if (e.target && e.target.closest && (e.target.closest('.canvas-inline-editor') || e.target.closest('canvas'))) {
          return;
        }
        annotations.forEach(a => { if (a.isEditing) onUpdateAnnotation({ ...a, isEditing: false }) });
        setSelectedTextIdx(null);
      }}
    >
      {/*
        DUAL-DOCUMENT PATTERN
        ────────────────────────────────────────────────────────────────
        While a new baked PDF is loading we render the OLD document as a static
        backdrop (position:absolute, z-index:0, opacity:1) so the user never
        sees a blank white or black canvas.  The incoming Document is rendered
        on top but invisible (opacity:0).  The instant onLoadSuccess fires we
        flip isNewDocLoading=false, the backdrop disappears, and the new
        document fades in.  Net result: zero flash.
      */}
      {isNewDocLoading && previousFile && (
        <Document
          file={previousFile}
          className="flex flex-col gap-6"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 0, pointerEvents: 'none' }}
          loading={null}
        >
          {Array.from(new Array(previousNumPages || numPages), (_, index) => (
            <Page
              key={`prev_page_${index + 1}`}
              pageNumber={index + 1}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={null}
            />
          ))}
        </Document>
      )}

      {/* The active / incoming document */}
      <Document
        file={file}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={(error) => {
          console.error('PDFViewer: document load error', error);
          // Safety: always clear the loading overlay so the UI doesn't get stuck
          setIsNewDocLoading(false);
        }}
        className="flex flex-col gap-6"
        style={{
          opacity: isNewDocLoading ? 0 : 1,
          transition: 'opacity 0.15s ease',
          position: 'relative',
          zIndex: 1,
        }}
        loading={<div className="font-semibold text-neutral-500 animate-pulse">Loading document...</div>}
      >
        {Array.from(new Array(numPages), (el, index) => (
          <div
            key={`page_${fileGeneration}_${index + 1}`}
            ref={el => { pageContainerRefs.current[index + 1] = el; }}
            className={`relative bg-white shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/20 transition-all duration-300 ease-in-out ${
              isWandActive ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-[#000000] cursor-crosshair'
              : activeTool === 'draw' || activeTool === 'signature' ? 'cursor-crosshair'
              : activeTool === 'eraser' ? 'cursor-cell'
              : activeTool === 'highlight' || activeTool === 'shape' ? 'cursor-crosshair'
              : ''
            }`}
            onPointerDown={(e) => handlePagePointerDown(e, index, e.currentTarget)}
            onPointerMove={(e) => handlePagePointerMove(e, index, e.currentTarget)}
            onPointerUp={(e) => handlePagePointerUp(e, index, e.currentTarget)}
            onClick={(e) => handlePageClick(e, index, e.currentTarget)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleImageDrop(e, index, e.currentTarget)}
          >
            <Page
              pageNumber={index + 1}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onLoadSuccess={async (page) => {
                const newSize = {
                  height: page.originalHeight || page.view[3],
                };
                
                try {
                  const textContent = await page.getTextContent();
                  const viewport1 = page.getViewport({ scale: 1.0 });
                  const pageHeight = viewport1.height;

                  const nativeItems = [];
                  textContent.items.forEach((item) => {
                    if (!item.str || item.str.trim() === '') return;
                    const tx = item.transform[4];
                    const ty = item.transform[5];
                    const fontH = Math.abs(item.transform[3]) || item.height || 12;
                    const pdfY_top = Math.max(0, pageHeight - ty - fontH);

                    nativeItems.push({
                      str: item.str,
                      pdfX: tx,
                      pdfY_base: ty,
                      pdfY_top: pdfY_top,
                      pdfW: item.width || (item.str.length * fontH * 0.5),
                      pdfH: fontH,
                      fontSize: fontH,
                      fontName: item.fontName || 'Helvetica',
                      fontPostScriptName: item.fontName || 'Helvetica',
                      ascender_h: fontH * 0.8,
                      descender_h: fontH * 0.2,
                      color: 'rgb(0, 0, 0)',
                      isBold: false,
                      isItalic: false,
                    });
                  });

                  setPageMetadata((prev) => {
                    const existing = prev[index + 1] || {};
                    return {
                      ...prev,
                      [index + 1]: {
                        ...existing,
                        size: newSize,
                        items: existing.items || nativeItems,
                      },
                    };
                  });
                } catch (e) {
                  console.warn('Browser native PDF text extraction fallback:', e);
                  setPageMetadata((prev) => ({
                    ...prev,
                    [index + 1]: { ...(prev[index + 1] || {}), size: newSize },
                  }));
                }
              }}

              onRenderSuccess={() => {
                // Intentionally empty.
                // Color sampling is handled by the pageMetadata useEffect above,
                // which runs after React has committed the DOM — guaranteeing the
                // canvas and text layer spans are present before we read them.
              }}
            />

            {/* Text hit-testing overlay and inline editor */}
            {pageMetadata[index + 1]?.items && pageMetadata[index + 1]?.size && (
              <>
                {debugMode && (
                  <DebugOverlay
                    items={pageMetadata[index + 1].items}
                    scale={scale}
                    selectedIdx={activePageNum === index + 1 ? selectedTextIdx : null}
                    debugFontWeightCompare={debugFontWeightCompare}
                  />
                )}

                <TextOverlay
                  items={pageMetadata[index + 1].items}
                  scale={scale}
                  selectedIdx={activePageNum === index + 1 ? selectedTextIdx : null}
                  edits={edits.filter(e => e.pageNum === index + 1)}
                  fontsLoaded={fontsLoaded}
                  activeBlockShift={activePageNum === index + 1 ? activeBlockShift : null}
                  onSelect={(idx) => {
                    setSelectedTextIdx(idx);
                    setActivePageNum(index + 1);
                  }}
                />

                {activePageNum === index + 1 && selectedTextIdx !== null && pageMetadata[index + 1].items[selectedTextIdx] && (() => {
                  const item = pageMetadata[index + 1].items[selectedTextIdx];
                  return (
                    <CanvasInlineEditor
                      key={`${activePageNum}-${selectedTextIdx}-${item.str}`}
                      item={item}
                      scale={scale}
                      existingEdit={edits.find(e => e.pageNum === index + 1 && e.nodeIndex === selectedTextIdx)}
                      onHeightChange={(activePdfY, deltaH) => {
                        setActiveBlockShift(prev => {
                          if (
                            prev &&
                            prev.pageNum === index + 1 &&
                            prev.activePdfY === activePdfY &&
                            Math.abs(prev.deltaH - deltaH) < 0.5
                          ) {
                            return prev; // bail out — same reference, no re-render triggered
                          }
                          return { pageNum: index + 1, activePdfY, deltaH };
                        });
                      }}
                      onCommit={(newVal, formatOptions, newSuperscriptRanges) => {
                        const origItem = pageMetadata[index + 1].items[selectedTextIdx];
                        pdfEditStore.commitEdit(activeFileId, {
                          pageNum: index + 1,
                          origStr: origItem.str,
                          newStr: newVal,
                          lines: formatOptions.lines || [],
                          origin_y: origItem.pdfY_base,
                          ascender_h: origItem.ascender_h,
                          descender_h: origItem.descender_h,
                          rect: {
                            x: origItem.pdfX,
                            y: origItem.pdfY_top,
                            w: origItem.pdfW,
                            h: origItem.pdfH
                          },
                          origFontSize: origItem.fontSize,
                          fontSizeAdj: formatOptions.fontSizeAdj,
                          fontName: origItem.fontName,
                          color: formatOptions.color,
                          customFontFamily: formatOptions.fontFamily,
                          isBold: formatOptions.isBold,
                          isItalic: formatOptions.isItalic,
                          isParagraph: origItem.isParagraph || false,
                          lineCount: origItem.lineCount || 1,
                          nodeIndex: selectedTextIdx,
                          // CanvasInlineEditor produces fresh superscriptRanges
                          superscriptRanges: newSuperscriptRanges || [],
                        });
                        setSelectedTextIdx(null);
                        setActiveBlockShift(null);
                        if (onLivePreview) setTimeout(onLivePreview, 0);
                      }}
                      onCancel={() => {
                        setSelectedTextIdx(null);
                        setActiveBlockShift(null);
                      }}
                    />
                  );
                })()}
              </>
            )}

            {/* Draggable free-form annotations */}
            {annotations.filter(a => a.pageIndex === index).map(ann => (
              <DraggableElement
                key={ann.id}
                annotation={ann}
                scale={scale}
                onUpdate={onUpdateAnnotation}
                onDelete={() => onDeleteAnnotation(ann.id)}
              />
            ))}

            {/* ── Canvas Annotation SVG Overlay ──────────────────────────── */}
            <svg
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                overflow: 'visible', pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <defs>
                <marker id={`arrowhead-${index}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="currentColor" />
                </marker>
              </defs>

              {/* Committed annotations */}
              {canvasAnnotations.filter(a => a.pageIndex === index).map(ann => {
                const bx = (ann.x || 0) * scale;
                const by = (ann.y || 0) * scale;
                const bw = (ann.width || 0) * scale;
                const bh = (ann.height || 0) * scale;
                const delX = (ann.type === 'freehand' || ann.type === 'signature')
                  ? (ann.path?.[0]?.x || 0) * scale
                  : bx + bw;
                const delY = (ann.type === 'freehand' || ann.type === 'signature')
                  ? (ann.path?.[0]?.y || 0) * scale
                  : by;
                return (
                  <g key={ann.id} style={{ pointerEvents: 'auto' }} className="group">
                    {ann.type === 'highlight' && (
                      <rect x={bx} y={by} width={bw} height={bh}
                        fill={ann.color || '#FFD700'} fillOpacity={ann.opacity ?? 0.45} rx={2} />
                    )}
                    {ann.type === 'shape' && ann.shapeType === 'rect' && (
                      <rect x={bx} y={by} width={bw} height={bh}
                        stroke={ann.strokeColor || '#000'}
                        fill={ann.fillColor || 'none'}
                        fillOpacity={ann.opacity ?? 1}
                        strokeWidth={ann.strokeWidth || 2} rx={2} />
                    )}
                    {ann.type === 'shape' && ann.shapeType === 'circle' && (
                      <ellipse cx={bx + bw / 2} cy={by + bh / 2} rx={bw / 2} ry={bh / 2}
                        stroke={ann.strokeColor || '#000'}
                        fill={ann.fillColor || 'none'}
                        fillOpacity={ann.opacity ?? 1}
                        strokeWidth={ann.strokeWidth || 2} />
                    )}
                    {ann.type === 'shape' && ann.shapeType === 'line' && (
                      <line x1={bx} y1={by} x2={bx + bw} y2={by + bh}
                        stroke={ann.strokeColor || '#000'}
                        strokeWidth={ann.strokeWidth || 2} />
                    )}
                    {ann.type === 'shape' && ann.shapeType === 'arrow' && (
                      <line x1={bx} y1={by} x2={bx + bw} y2={by + bh}
                        stroke={ann.strokeColor || '#000'}
                        strokeWidth={ann.strokeWidth || 2}
                        markerEnd={`url(#arrowhead-${index})`}
                        color={ann.strokeColor || '#000'} />
                    )}
                    {(ann.type === 'freehand' || ann.type === 'signature') && ann.path && (
                      <polyline
                        points={ann.path.map(pt => `${pt.x * scale},${pt.y * scale}`).join(' ')}
                        fill="none"
                        stroke={ann.color || '#000'}
                        strokeWidth={ann.strokeWidth || 2}
                        strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    {ann.type === 'image' && (
                      <rect x={bx} y={by} width={bw} height={bh}
                        fill="#a855f7" fillOpacity={0.12}
                        stroke="#a855f7" strokeWidth={1} strokeDasharray="5 3" rx={4} />
                    )}
                    {ann.type === 'sticky_note' && (
                      <>
                        <rect x={bx - 4} y={by - 22} width={84} height={22} rx={4}
                          fill={ann.color || '#FFD700'} />
                        <text x={bx + 2} y={by - 6} fontSize="9" fill="#333" fontFamily="sans-serif">
                          {String(ann.text || '').slice(0, 14)}{(ann.text?.length || 0) > 14 ? '…' : ''}
                        </text>
                      </>
                    )}
                    {/* Delete button — visible on group hover */}
                    <circle cx={delX} cy={delY} r={9}
                      fill="#ef4444"
                      className="opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                      style={{ pointerEvents: 'auto' }}
                      onClick={(e) => { e.stopPropagation(); onDeleteCanvasAnnotation?.(ann.id); }} />
                    <text x={delX} y={delY + 3.5} textAnchor="middle" fontSize="11" fill="white"
                      fontWeight="bold"
                      className="opacity-0 group-hover:opacity-100 transition-opacity select-none"
                      style={{ pointerEvents: 'none' }}>✕</text>
                  </g>
                );
              })}

              {/* Live drawing preview */}
              {drawingState && drawingState.pageIndex === index && (() => {
                const ds = drawingState;
                const lx = Math.min(ds.startX, ds.currentX) * scale;
                const ly = Math.min(ds.startY, ds.currentY) * scale;
                const lw = Math.abs(ds.currentX - ds.startX) * scale;
                const lh = Math.abs(ds.currentY - ds.startY) * scale;
                if (ds.tool === 'highlight') return (
                  <rect x={lx} y={ly} width={lw} height={lh}
                    fill={toolSettings.highlightColor || '#FFD700'} fillOpacity={0.4}
                    stroke={toolSettings.highlightColor || '#FFD700'} strokeWidth={1} strokeDasharray="4 2" />
                );
                if (ds.tool === 'eraser') return (
                  <rect x={lx} y={ly} width={lw} height={lh}
                    fill="white" fillOpacity={0.9} stroke="#999" strokeWidth={1} strokeDasharray="4 2" />
                );
                if (ds.tool === 'shape') {
                  if ((toolSettings.shapeType || 'rect') === 'circle') return (
                    <ellipse cx={lx + lw / 2} cy={ly + lh / 2} rx={lw / 2} ry={lh / 2}
                      stroke={toolSettings.color || '#000'} fill="none"
                      strokeWidth={toolSettings.strokeWidth || 2} strokeDasharray="4 2" />
                  );
                  if ((toolSettings.shapeType || 'rect') === 'line') return (
                    <line x1={ds.startX * scale} y1={ds.startY * scale} x2={ds.currentX * scale} y2={ds.currentY * scale}
                      stroke={toolSettings.color || '#000'} strokeWidth={toolSettings.strokeWidth || 2} strokeDasharray="4 2" />
                  );
                  return (
                    <rect x={lx} y={ly} width={lw} height={lh}
                      stroke={toolSettings.color || '#000'} fill="none"
                      strokeWidth={toolSettings.strokeWidth || 2} strokeDasharray="4 2" />
                  );
                }
                if (ds.tool === 'draw' || ds.tool === 'signature') return (
                  <polyline
                    points={ds.path.map(pt => `${pt.x * scale},${pt.y * scale}`).join(' ')}
                    fill="none" stroke={toolSettings.color || '#000'}
                    strokeWidth={toolSettings.strokeWidth || 2}
                    strokeLinecap="round" strokeLinejoin="round" />
                );
                return null;
              })()}
            </svg>
          </div>
        ))}
      </Document>

      {/* Floating Debugger Status Bar */}
      {debugMode && (
        <div className="fixed top-20 right-8 z-[200] bg-gray-900/95 text-white text-xs px-3.5 py-2 rounded-xl shadow-2xl border border-gray-700/80 flex items-center gap-3 backdrop-blur-md">
          <span className="flex items-center gap-1.5 font-bold text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>🛠️</span> Debugger Active
          </span>
          <span className="text-gray-600">|</span>
          <button
            onClick={() => setDebugFontWeightCompare(prev => !prev)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              debugFontWeightCompare
                ? 'bg-purple-600 hover:bg-purple-500 text-white ring-2 ring-purple-400'
                : 'bg-purple-950/90 hover:bg-purple-900 text-purple-300 border border-purple-700/70'
            }`}
          >
            <span>{debugFontWeightCompare ? '⚡' : '🔍'}</span>
            <span>{debugFontWeightCompare ? 'DOM Font A/B Active' : 'Enable DOM vs Canvas A/B'}</span>
          </button>
          <span className="text-gray-600">|</span>
          <span className="font-mono text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">Ctrl+Shift+D</span>
          <button
            onClick={() => setDebugMode(false)}
            className="ml-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded p-1 transition-colors"
            title="Close Debugger"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}