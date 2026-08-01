import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useSyncExternalStore } from 'react';
import { pdfToScreen } from '../../utils/pdfCoords';
import { SUPER_MAP, UNICODE_SUPER_MAP, UNICODE_SUB_MAP } from './superscriptUtils';
import { pdfTypographyStore } from '../../stores/pdfTypographyStore';
import { activeFileId } from '../../stores/pdfEditStore';
import { getFontStemVwRatio } from '../../utils/pdfFontLoader';

const rgbToHex = (colorStr) => {
  if (colorStr == null) return '#000000';
  if (typeof colorStr === 'number') {
    const hex = colorStr.toString(16).padStart(6, '0');
    return `#${hex}`;
  }
  if (Array.isArray(colorStr)) {
    const [r, g, b] = colorStr.map(c => Math.round(c <= 1 ? c * 255 : c).toString(16).padStart(2, '0'));
    return `#${r}${g}${b}`;
  }
  if (typeof colorStr !== 'string') return '#000000';
  if (colorStr.startsWith('#')) return colorStr;
  const match = colorStr.match(/\d+/g);
  if (!match || match.length < 3) return '#000000';
  return '#' + match.slice(0, 3).map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
};

const SUPERSAMPLE_FACTOR = 2; // extra sharpness multiplier beyond native devicePixelRatio
const MAX_EFFECTIVE_DPR = 4;  // hard cap to bound memory/CPU on already-high-DPR devices

// FALLBACK: used when the font has no derivable StdVW — TrueType-outline fonts,
// CFF subsets that stripped it, or PDFs using non-embedded base-14 fonts (in which
// case the browser is substituting a system font anyway, not the PDF's real glyphs,
// so a visually-tuned curve is actually the *correct* tool here, not just a compromise).
const getStemDarkeningPxHeuristic = (fontSizePx) => {
  const SMALL_PX = 11;
  const LARGE_PX = 22;
  const MAX_DARKEN = 0.18; // calibrated down from 0.35 to prevent overshooting body text
  if (fontSizePx <= SMALL_PX) return MAX_DARKEN;
  if (fontSizePx >= LARGE_PX) return 0;
  const t = (fontSizePx - SMALL_PX) / (LARGE_PX - SMALL_PX);
  return MAX_DARKEN * (1 - t);
};

// PRIMARY: real per-font metric extracted from the embedded CFF's Private dict.
const FT_DARKENING_CURVE = [
  [0.5, 0.4],
  [1.0, 0.275],
  [1.667, 0.275],
  [2.333, 0.0],
];

const freeTypeStemDarkeningPx = (stemWidthPx) => {
  const pts = FT_DARKENING_CURVE;
  if (stemWidthPx <= pts[0][0]) return pts[0][1];
  if (stemWidthPx >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if (stemWidthPx >= x0 && stemWidthPx <= x1) {
      const t = (stemWidthPx - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
};

// Single entry point drawCanvasLine actually calls.
const getStemDarkeningPx = (fontSizePx, stemVwRatio) => {
  if (stemVwRatio == null) return getStemDarkeningPxHeuristic(fontSizePx);
  const stemWidthPx = stemVwRatio * fontSizePx;
  return freeTypeStemDarkeningPx(stemWidthPx);
};

const FONTS = ['Original', 'Arial', 'Times New Roman', 'Courier', 'Verdana', 'Georgia'];

// SUPER_MAP, UNICODE_SUPER_MAP, UNICODE_SUB_MAP, normalizeText are imported from superscriptUtils.js
// (kept in a separate non-JSX file to satisfy Vite React Fast Refresh requirements)

const isCJKChar = (ch) => {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef)
  );
};

/**
 * Sanitize non-breaking spaces (\u00A0) back to standard ASCII spaces (\u0020)
 * before committing to pdfEditStore/backend.
 */
const sanitizeForCommit = (text) => {
  if (!text) return '';
  return text.replace(/\u00A0/g, ' ');
};

/**
 * Strip 6-letter subset tag prefix (e.g. "NBUDXT+MetaProLight-Regular" -> "MetaProLight-Regular")
 */
const stripSubset = (name) => (name || '').replace(/^[A-Z]{6}\+/, '');
const sanitizeFontName = (name) => (name || '').replace(/\s*-\s*/g, '-');

/**
 * Extract character metadata (normal, super, sub) for a text string,
 * taking into account superscriptRanges, HTML <sup>/<sub> tags, or Unicode superscripts.
 */
function parseCharMetadata(rawText, initialRanges = [], origLines = null) {
  if (!rawText) return { cleanText: '', charMeta: [] };

  const backendChars = (origLines && Array.isArray(origLines))
    ? origLines.flatMap(l => l.chars || [])
    : [];

  const charMeta = [];
  const cleanChars = [];

  if (backendChars.length > 0) {
    const rawNonSpace = [];
    for (let i = 0; i < rawText.length; i++) {
      if (!/\s/.test(rawText[i])) rawNonSpace.push({ char: rawText[i], rawIdx: i });
    }

    const backendNonSpace = [];
    for (let b = 0; b < backendChars.length; b++) {
      const c = backendChars[b].c ?? backendChars[b].char ?? '';
      if (!/\s/.test(c)) backendNonSpace.push({ char: c, bIdx: b, meta: backendChars[b] });
    }

    let prefixCount = 0;
    while (
      prefixCount < rawNonSpace.length &&
      prefixCount < backendNonSpace.length &&
      rawNonSpace[prefixCount].char === backendNonSpace[prefixCount].char
    ) {
      prefixCount++;
    }

    let suffixCount = 0;
    while (
      suffixCount < (rawNonSpace.length - prefixCount) &&
      suffixCount < (backendNonSpace.length - prefixCount) &&
      rawNonSpace[rawNonSpace.length - 1 - suffixCount].char === backendNonSpace[backendNonSpace.length - 1 - suffixCount].char
    ) {
      suffixCount++;
    }

    const rawToBackendMap = new Map();
    for (let p = 0; p < prefixCount; p++) {
      rawToBackendMap.set(rawNonSpace[p].rawIdx, backendNonSpace[p].meta);
    }
    for (let s = 0; s < suffixCount; s++) {
      const rawIdx = rawNonSpace[rawNonSpace.length - 1 - s].rawIdx;
      const bMeta = backendNonSpace[backendNonSpace.length - 1 - s].meta;
      rawToBackendMap.set(rawIdx, bMeta);
    }

    for (let i = 0; i < rawText.length; i++) {
      const rawCh = rawText[i];
      if (/\s/.test(rawCh)) {
        cleanChars.push(rawCh);
        charMeta.push({
          origChar: rawCh,
          displayChar: rawCh,
          kind: 'normal',
          color: undefined,
          charIndex: i
        });
        continue;
      }

      const bMeta = rawToBackendMap.get(i);
      if (bMeta) {
        const kind = bMeta.is_superscript ? 'super' : (bMeta.is_subscript ? 'sub' : 'normal');
        const displayChar = SUPER_MAP[bMeta.c] || bMeta.c;
        const origChar = SUPER_MAP[bMeta.c] || bMeta.c;
        const color = bMeta.color || undefined;

        cleanChars.push(origChar);
        charMeta.push({
          origChar,
          displayChar,
          kind,
          color,
          charIndex: i
        });
      } else {
        let kind = 'normal';
        let displayChar = rawCh;
        let origChar = rawCh;
        if (UNICODE_SUPER_MAP[rawCh]) {
          kind = 'super';
          displayChar = UNICODE_SUPER_MAP[rawCh];
          origChar = UNICODE_SUPER_MAP[rawCh];
        } else if (UNICODE_SUB_MAP[rawCh]) {
          kind = 'sub';
          displayChar = UNICODE_SUB_MAP[rawCh];
          origChar = UNICODE_SUB_MAP[rawCh];
        }
        cleanChars.push(origChar);
        charMeta.push({
          origChar,
          displayChar,
          kind,
          color: undefined,
          charIndex: i
        });
      }
    }
  } else {
    // Parse HTML <sup> / <sub> tags if rawText contains them
    let text = rawText;
    let rangesFromTags = [];
    if (text.includes('<sup>') || text.includes('<sub>')) {
      let clean = '';
      let ranges = [];
      let regex = /<(sup|sub)>(.*?)<\/\1>/gi;
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(text)) !== null) {
        clean += text.slice(lastIndex, match.index);
        let tagKind = match[1].toLowerCase();
        if (tagKind === 'sup') tagKind = 'super';
        const tagContent = match[2];
        const start = clean.length;
        clean += tagContent;
        const end = clean.length;
        ranges.push({ kind: tagKind, charStart: start, charEnd: end });
        lastIndex = regex.lastIndex;
      }
      clean += text.slice(lastIndex);
      text = clean;
      rangesFromTags = ranges;
    }

    const normalizedInitialRanges = (initialRanges || []).map(r => ({
      ...r,
      kind: r.kind === 'sup' ? 'super' : r.kind
    }));
    const mergedRanges = [...normalizedInitialRanges, ...rangesFromTags];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      let kind = 'normal';
      let displayChar = ch;
      let origChar = ch;
      let color = undefined;

      // Check merged ranges
      const range = mergedRanges.find(r => i >= r.charStart && i < r.charEnd);
      if (range) {
        kind = range.kind === 'sup' ? 'super' : range.kind;
        color = range.color;
        if (UNICODE_SUPER_MAP[ch]) {
          displayChar = UNICODE_SUPER_MAP[ch];
          origChar = UNICODE_SUPER_MAP[ch];
        } else if (UNICODE_SUB_MAP[ch]) {
          displayChar = UNICODE_SUB_MAP[ch];
          origChar = UNICODE_SUB_MAP[ch];
        }
      } else if (UNICODE_SUPER_MAP[ch]) {
        kind = 'super';
        displayChar = UNICODE_SUPER_MAP[ch];
        origChar = UNICODE_SUPER_MAP[ch];
      } else if (UNICODE_SUB_MAP[ch]) {
        kind = 'sub';
        displayChar = UNICODE_SUB_MAP[ch];
        origChar = UNICODE_SUB_MAP[ch];
      }

      cleanChars.push(origChar);
      charMeta.push({
        origChar,
        displayChar,
        kind,
        color,
        charIndex: i
      });
    }
  }

  const cleanText = cleanChars.join('');
  return { cleanText, charMeta };
}

/**
 * Re-build superscript/subscript range metadata from charMeta for committing to store
 */
function extractRangesFromCharMeta(charMeta) {
  if (!charMeta || charMeta.length === 0) return [];
  const ranges = [];
  let currentRange = null;

  for (let i = 0; i < charMeta.length; i++) {
    const meta = charMeta[i];
    if (meta.kind === 'super' || meta.kind === 'sub') {
      if (currentRange && currentRange.kind === meta.kind) {
        currentRange.charEnd = i + 1;
      } else {
        if (currentRange) ranges.push(currentRange);
        currentRange = {
          kind: meta.kind,
          charStart: i,
          charEnd: i + 1,
          color: meta.color
        };
      }
    } else {
      if (currentRange) {
        ranges.push(currentRange);
        currentRange = null;
      }
    }
  }
  if (currentRange) ranges.push(currentRange);
  return ranges;
}

const detectBold = (item) => {
  if (item?.isBold === true) return true;
  const name = (item?.fontPostScriptName || item?.fontName || '').toLowerCase();
  if (/bold|heavy|black|w[6-9]|semibold/.test(name)) return true;
  if (typeof item?.flags === 'number' && (item.flags & 2)) return true;
  return false;
};

const detectItalic = (item) => {
  if (item?.isItalic === true) return true;
  const name = (item?.fontPostScriptName || item?.fontName || '').toLowerCase();
  if (/italic|oblique/.test(name)) return true;
  if (typeof item?.flags === 'number' && (item.flags & 1)) return true;
  return false;
};

const extractColor = (item) => {
  if (item?.color) return rgbToHex(item.color);
  const firstChar = item?.origLines?.[0]?.chars?.[0] || item?.lines?.[0]?.chars?.[0];
  if (firstChar?.color) return rgbToHex(firstChar.color);
  return '#000000';
};

export function CanvasInlineEditor({ item, scale, existingEdit, onCommit, onCancel, onHeightChange }) {
  const getInitialText = useCallback(() => {
    if (existingEdit && existingEdit.newStr) return existingEdit.newStr;
    if (item.lines && item.lines.length > 0) {
      return item.lines.map(l => (typeof l === 'string' ? l : (l?.text || l))).join('\n');
    }
    if (item.rawPdfLines && item.rawPdfLines.length > 0) return item.rawPdfLines.join('\n');
    return item.str || item.text || '';
  }, [existingEdit, item]);

  const rawInitialStr = getInitialText();
  const origLines = item?.origLines || (Array.isArray(item?.lines) && item.lines[0]?.chars ? item.lines : null) || item?.blockData?.origLines;
  const initialParsed = useMemo(() => {
    const rawInitialRanges = existingEdit ? existingEdit.superscriptRanges || [] : item.superscriptRanges || [];
    return parseCharMetadata(rawInitialStr, rawInitialRanges, origLines);
  }, [rawInitialStr, existingEdit, item, origLines]);
  const initialStr = initialParsed.cleanText;
  const initialRanges = useMemo(() => extractRangesFromCharMeta(initialParsed.charMeta), [initialParsed.charMeta]);

  // Text state
  const [text, setText] = useState(initialStr);
  const [selection, setSelection] = useState(() => ({ start: initialStr.length, end: initialStr.length }));
  const [isFocused, setIsFocused] = useState(false);
  const [_isComposing, setIsComposing] = useState(false);
  const [caretVisible, setCaretVisible] = useState(true);

  // Formatting state
  const [fontSizeAdj, setFontSizeAdj] = useState(existingEdit ? existingEdit.fontSizeAdj : 0);
  const [color, setColor] = useState(() => existingEdit?.color || extractColor(item));
  const [fontFamily, setFontFamily] = useState(() => existingEdit?.customFontFamily || 'Original');
  const [isBold, setIsBold] = useState(() => (existingEdit ? existingEdit.isBold : detectBold(item)));
  const [isItalic, setIsItalic] = useState(() => (existingEdit ? existingEdit.isItalic : detectItalic(item)));

  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const textRef = useRef(initialStr);
  const selectionRef = useRef({ start: initialStr.length, end: initialStr.length });
  const isTypingRef = useRef(false);

  const canvasRef = useRef(null);
  const textareaRef = useRef(null);
  const editorContainerRef = useRef(null); // wraps all editor DOM elements
  const handleCommitRef = useRef(null);    // stable ref to latest handleCommit
  const isDraggingRef = useRef(false);
  const dragAnchorRef = useRef(0);
  const isProgrammaticSelectionRef = useRef(false);

  // Connect to pdfTypographyStore for reactive typography updates
  useSyncExternalStore(
    pdfTypographyStore.subscribe,
    () => pdfTypographyStore.getTypographyData(activeFileId)
  );

  const paragraphTypography = useMemo(() => {
    if (item?.paragraphTypography) return item.paragraphTypography;
    if (item?.paragraph_id) {
      return {
        font_size: item.paragraph_font_size || item.fontSize,
        font_family: item.paragraph_font_family || item.fontName || 'Helvetica',
        color: item.paragraph_color || item.color || '#000000',
        align: item.paragraph_align || item.align || 'left',
        paragraph_id: item.paragraph_id,
        text: item.paragraph_text || item.str || item.text || '',
      };
    }
    const pageIndex = (item?.pageNum != null ? item.pageNum : 1) - 1;
    const storeP = pdfTypographyStore.getParagraphAt(
      activeFileId,
      pageIndex,
      item?.pdfX ?? 0,
      item?.pdfY_top ?? item?.pdfY_base ?? 0
    );
    if (storeP) {
      return {
        font_size: storeP.font_size,
        font_family: storeP.font_family,
        color: storeP.hex_color || storeP.font_color,
        align: storeP.align || 'left',
        paragraph_id: storeP.paragraph_id,
        text: storeP.text,
      };
    }
    return {
      font_size: item?.fontSize || 12,
      font_family: item?.fontPostScriptName || item?.fontName || 'Helvetica',
      color: item?.color || '#000000',
      align: item?.align || 'left',
      paragraph_id: null,
      text: item?.str || item?.text || '',
    };
  }, [item]);

  const r = pdfToScreen(item, scale);
  const baseFontSizePx = Math.max(8, (item.fontSize * scale) + fontSizeAdj);
  // Authoritative block alignment from PyMuPDF or paragraphTypography
  const blockAlign = paragraphTypography.align || item.align || 'left';

  const firstCharFont = origLines?.[0]?.chars?.[0]?.font || item?.lines?.[0]?.chars?.[0]?.font;

  // Build Comprehensive Font Stack
  const fontCandidates = [
    item.fontPostScriptName,
    stripSubset(item.fontPostScriptName),
    item.fontName,
    stripSubset(item.fontName),
    item.font,
    stripSubset(item.font),
    firstCharFont,
    stripSubset(firstCharFont),
  ].filter(Boolean);
  const uniqueCandidates = [...new Set(fontCandidates)];
  const sanitizedCandidates = uniqueCandidates.map(sanitizeFontName);
  const realFontStack = sanitizedCandidates.map(n => `"${n}"`).join(', ');

  const isSans = sanitizedCandidates.some(n => /helvetica|arial|sans|gothic|verdana|tahoma|trebuchet|roboto/i.test(n));
  const fallbackStack = isSans
    ? 'sans-serif, Arial, "Helvetica Neue", Helvetica'
    : 'serif, "Times New Roman", Georgia';

  const currentFontFamily = fontFamily === 'Original'
    ? (item.renderedFontFamily || (realFontStack ? `${realFontStack}, ${fallbackStack}` : fallbackStack))
    : fontFamily;

  const isFontEmbeddedAndActive = useMemo(() => {
    if (fontFamily !== 'Original') return false;
    try {
      return sanitizedCandidates.some(name => document.fonts.check(`12px "${name}"`));
    } catch {
      return false;
    }
  }, [fontFamily, sanitizedCandidates]);

  // Mobile keyboard offset
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const reposition = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      setKeyboardOffset(keyboardHeight > 0 ? keyboardHeight : 0);
    };
    vv.addEventListener('resize', reposition);
    return () => vv.removeEventListener('resize', reposition);
  }, []);

  // Auto focus offscreen textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(text.length, text.length);
      setIsFocused(true);
    }
  }, []);

  // Sync initial text value to DOM element on mount or prop change
  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== textRef.current) {
      textareaRef.current.value = textRef.current;
    }
  }, [initialStr]);

  // Synchronize native textarea selection range with React selection state immediately after DOM updates
  useLayoutEffect(() => {
    if (textareaRef.current && isFocused) {
      try {
        textareaRef.current.setSelectionRange(selection.start, selection.end);
      } catch {
        /* ignore selection range errors when unfocused */
      }
    }
  }, [selection.start, selection.end, text, isFocused]);

  // ── Document-level mousedown: industry-standard "click outside" commit ──────────────
  // ProseMirror, Fabric.js, Konva.js all use this pattern instead of onBlur.
  // Reason: clicking the canvas (non-focusable) fires blur with relatedTarget=null,
  // making it impossible to distinguish a caret reposition from a true exit.
  // document mousedown (capture phase) fires BEFORE focus changes, giving us
  // reliable containment checks while keeping the textarea focused.
  useEffect(() => {
    const handleDocMouseDown = (e) => {
      const container = editorContainerRef.current;
      if (!container) return;
      // If click is inside any editor element, keep editing
      if (container.contains(e.target)) return;
      // Click is outside — commit and exit
      if (handleCommitRef.current) handleCommitRef.current();
    };
    document.addEventListener('mousedown', handleDocMouseDown, true /* capture */);
    return () => document.removeEventListener('mousedown', handleDocMouseDown, true);
  }, []); // empty deps: stable via handleCommitRef

  // Blinking Caret Timer (500ms cycle)
  useEffect(() => {
    if (!isFocused || selection.start !== selection.end) {
      setCaretVisible(false);
      return;
    }
    setCaretVisible(true);
    const interval = setInterval(() => {
      setCaretVisible(v => !v);
    }, 500);
    return () => clearInterval(interval);
  }, [isFocused, selection.start, selection.end]);

  /**
   * Helper to extract scaled PyMuPDF line bounds (line_x0, line_x1) for line positioning & justification
   */
  const getOrigLineBounds = useCallback((origLine, lineIdx) => {
    let x0 = null;
    if (origLine && typeof origLine === 'object') {
      x0 = origLine.line_x0 ?? origLine.pdfX ?? (Array.isArray(origLine.bbox) ? origLine.bbox[0] : null);
    }
    if (x0 == null) {
      x0 = item.pdfX + (lineIdx === 0 && item.textIndent ? item.textIndent : 0);
    }
    // Exact right boundary drawn by the backend container box:
    let containerRightX = item.pdfX + (item.pdfW || (r.w / scale));
    if (Array.isArray(item.bbox) && item.bbox[2] != null) {
      containerRightX = Math.max(containerRightX, item.bbox[2]);
    }
    if (item.blockData && Array.isArray(item.blockData.bbox) && item.blockData.bbox[2] != null) {
      containerRightX = Math.max(containerRightX, item.blockData.bbox[2]);
    }

    return { line_x0: x0, line_x1: containerRightX };
  }, [item.pdfX, item.pdfW, item.bbox, item.blockData, item.textIndent, r.w, scale]);

  /**
   * Layout Engine: Breaks text into lines, applies Atomic Citation Unit binding,
   * measures character X offsets, and calculates dual-baseline vertical positions.
   */
  const computeLineLayout = useCallback((ctx) => {
    const { charMeta } = parseCharMetadata(text, initialRanges, origLines);
    
    // Font specs
    const baseFont = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${baseFontSizePx}px ${currentFontFamily}`;
    const superFont = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${Math.round(baseFontSizePx * 0.65)}px ${currentFontFamily}`;

    // Measure HTML ascender
    ctx.font = baseFont;
    let ascenderPx = baseFontSizePx * 0.8;
    try {
      const m = ctx.measureText('Hpx');
      if (m.fontBoundingBoxAscent != null && !isNaN(m.fontBoundingBoxAscent)) {
        ascenderPx = m.fontBoundingBoxAscent;
      } else if (m.actualBoundingBoxAscent != null && !isNaN(m.actualBoundingBoxAscent)) {
        ascenderPx = m.actualBoundingBoxAscent;
      }
    } catch {
      // Fall back to default ascender estimate if font metrics unavailable
    }

    // Hard line breaks matching original PDF line structure (text.split('\n'))
    const rawLinesText = text.split('\n');
    const lines = [];

    // Calculate line height using ACTUAL PDF-derived line height.
    const pdfLineHeight = item.lineHeight
      ? item.lineHeight * scale
      : (r.h > 0 && origLines && origLines.length > 0)
        ? r.h / origLines.length
        : baseFontSizePx * 1.2;
    const lineHeightPx = pdfLineHeight;

    let globalCharOffset = 0;
    let overflowUnitsFromPrevLine = [];

    for (let pIdx = 0; pIdx < rawLinesText.length || overflowUnitsFromPrevLine.length > 0; pIdx++) {
      const pText = pIdx < rawLinesText.length ? rawLinesText[pIdx] : '';
      const pMeta = charMeta.slice(globalCharOffset, globalCharOffset + pText.length);

      // Extract current line units from pMeta
      const lineUnits = [];
      let currentUnitChars = [];

      for (let i = 0; i < pMeta.length; i++) {
        const cm = pMeta[i];
        currentUnitChars.push(cm);

        const isLastInP = i === pMeta.length - 1;
        const nextIsSpace = !isLastInP && (pMeta[i + 1].origChar === ' ' || pMeta[i + 1].origChar === '\t');
        const currIsSpace = cm.origChar === ' ' || cm.origChar === '\t';
        const currIsCJK = isCJKChar(cm.origChar);
        const nextIsCJK = !isLastInP && isCJKChar(pMeta[i + 1].origChar);

        if (isLastInP || currIsSpace || nextIsSpace || currIsCJK || nextIsCJK) {
          if (!currIsSpace && !isLastInP && pMeta[i + 1].kind === 'super') {
            continue;
          }
          let unitWidth = 0;
          for (const ucm of currentUnitChars) {
            ctx.font = (ucm.kind === 'super' || ucm.kind === 'sub') ? superFont : baseFont;
            unitWidth += ctx.measureText(ucm.displayChar).width;
          }
          lineUnits.push({ chars: currentUnitChars, width: unitWidth });
          currentUnitChars = [];
        }
      }

      if (currentUnitChars.length > 0) {
        let unitWidth = 0;
        for (const ucm of currentUnitChars) {
          ctx.font = (ucm.kind === 'super' || ucm.kind === 'sub') ? superFont : baseFont;
          unitWidth += ctx.measureText(ucm.displayChar).width;
        }
        lineUnits.push({ chars: currentUnitChars, width: unitWidth });
      }

      // Combine overflow units from previous line with current line units
      const allUnitsForLine = [...overflowUnitsFromPrevLine, ...lineUnits];
      overflowUnitsFromPrevLine = [];

      const pOrigLine = (origLines && Array.isArray(origLines) && origLines[pIdx]) ? origLines[pIdx] : null;
      const { line_x0, line_x1 } = getOrigLineBounds(pOrigLine, pIdx);
      const pLineTargetW = Math.max(1, (line_x1 - line_x0) * scale);
      const pStartX = (line_x0 - item.pdfX) * scale;

      let currentLineUnits = [];
      let currentLineWidth = 0;

      const pushLine = (unitsToPush, isLastCanvasLineOfBlock = false) => {
        const lineChars = unitsToPush.flatMap(u => u.chars);
        const lineStr = lineChars.map(c => c.origChar).join('');
        const lineIdx = lines.length;

        const isLastLineOfParagraph = (pIdx >= rawLinesText.length - 1) && isLastCanvasLineOfBlock;

        const pdfChars = pOrigLine?.chars || [];
        const pdfNonSpaceChars = pdfChars.filter(ch => {
          const c = ch.c ?? ch.char ?? '';
          return c !== ' ' && c !== '\u00A0' && c.length > 0;
        });

        // Match leading non-space characters in lineChars against pdfNonSpaceChars
        const lineNonSpaceChars = lineChars.filter(
          cm => cm.origChar !== ' ' && cm.origChar !== '\u00A0'
        );

        // Word-boundary prefix matching: stop matching at the first edited word
        const lineWords = [];
        let curLineWord = '';
        for (const cm of lineChars) {
          const c = cm.origChar;
          if (c === ' ' || c === '\u00A0') {
            if (curLineWord.length > 0) {
              lineWords.push(curLineWord);
              curLineWord = '';
            }
          } else {
            curLineWord += c;
          }
        }
        if (curLineWord.length > 0) lineWords.push(curLineWord);

        const pdfWords = [];
        const pdfWordCharCounts = [];
        let curPdfWord = '';
        let curPdfCharCount = 0;

        for (const ch of pdfChars) {
          const c = ch.c ?? ch.char ?? '';
          if (c === ' ' || c === '\u00A0' || c.length === 0) {
            if (curPdfWord.length > 0) {
              pdfWords.push(curPdfWord);
              pdfWordCharCounts.push(curPdfCharCount);
              curPdfWord = '';
              curPdfCharCount = 0;
            }
          } else {
            curPdfWord += c;
            curPdfCharCount++;
          }
        }
        if (curPdfWord.length > 0) {
          pdfWords.push(curPdfWord);
          pdfWordCharCounts.push(curPdfCharCount);
        }

        let prefixMatchCount = 0;
        let linePrefixStartWordIdx = 0;
        if (pdfWords.length > 0) {
          const matchIdx = lineWords.indexOf(pdfWords[0]);
          if (matchIdx >= 0) {
            linePrefixStartWordIdx = matchIdx;
          }
        }

        let pdfWIdx = 0;
        for (let w = linePrefixStartWordIdx; w < lineWords.length && pdfWIdx < pdfWords.length; w++) {
          if (lineWords[w] === pdfWords[pdfWIdx]) {
            prefixMatchCount += pdfWordCharCounts[pdfWIdx];
            pdfWIdx++;
          } else {
            break;
          }
        }

        // Match trailing non-space characters (suffix) to preserve original PDF trailing kerning shifted by deltaX
        // Disable suffix matching on reflowed lines (lines with overflow from previous lines) to avoid invalid negative shifts
        let suffixMatchCount = 0;
        const isReflowedLine = allUnitsForLine.length > lineUnits.length;
        if (!isReflowedLine) {
          while (
            suffixMatchCount < (pdfNonSpaceChars.length - prefixMatchCount) &&
            suffixMatchCount < (lineNonSpaceChars.length - prefixMatchCount)
          ) {
            const pdfIdx = pdfNonSpaceChars.length - 1 - suffixMatchCount;
            const lineIdx2 = lineNonSpaceChars.length - 1 - suffixMatchCount;
            const pdfChar = pdfNonSpaceChars[pdfIdx]?.c ?? pdfNonSpaceChars[pdfIdx]?.char ?? '';
            const lineChar = lineNonSpaceChars[lineIdx2]?.origChar ?? '';
            if (pdfChar === lineChar && pdfChar.length > 0) {
              suffixMatchCount++;
            } else {
              break;
            }
          }
        }

        const isPurePrefixOrUnedited = (prefixMatchCount === pdfNonSpaceChars.length);
        const usePdfCoords = pdfNonSpaceChars.length > 0 && isPurePrefixOrUnedited;

        const shouldJustify = (item.align === 'justify' || item.isJustified ||
          (item.isParagraph && blockAlign === 'justify') || (origLines && origLines.length > 1));
        const spaceCount = lineChars.filter(cm => cm.origChar === ' ' || cm.origChar === '\u00A0').length;

        const firstSuffixPdfIdx = suffixMatchCount > 0
          ? pdfNonSpaceChars.length - suffixMatchCount
          : -1;
        const suffixStartNonSpaceIdx = lineNonSpaceChars.length - suffixMatchCount;

        let extraPerSpace = 0;
        if (!usePdfCoords && shouldJustify && !isLastLineOfParagraph && spaceCount > 0) {
          // Dry-run measurement: compute un-justified right edge of lineChars
          let testX = pStartX;
          let testPdfCharIdx = 0;
          let testDeltaX = 0;
          let testDeltaXComputed = false;
          let testNonSpaceCounter = 0;
          let testExtraSpaceShift = 0;
          let testPrevWasSpace = false;

          for (let i = 0; i < lineChars.length; i++) {
            const cm = lineChars[i];
            const isSpace = cm.origChar === ' ' || cm.origChar === '\u00A0';
            const isSuper = cm.kind === 'super' || cm.kind === 'sub';

            if (!isSpace && testPdfCharIdx < prefixMatchCount) {
              const pdfCh = pdfNonSpaceChars[testPdfCharIdx];
              if (linePrefixStartWordIdx > 0 && !testDeltaXComputed && testPdfCharIdx === 0) {
                const firstPrefixPdfX0 = (pdfNonSpaceChars[0].x0 - item.pdfX) * scale;
                testDeltaX = testX - firstPrefixPdfX0;
                testDeltaXComputed = true;
              }
              testX = (pdfCh.x1 - item.pdfX) * scale + testDeltaX + testExtraSpaceShift;
              testPdfCharIdx++;
              testPrevWasSpace = false;
            } else if (isSpace && testPdfCharIdx > 0 && testPdfCharIdx < prefixMatchCount) {
              if (!testPrevWasSpace) {
                const nextPdfCh = pdfNonSpaceChars[testPdfCharIdx];
                testX = (nextPdfCh.x0 - item.pdfX) * scale + testDeltaX + testExtraSpaceShift;
              } else {
                ctx.font = isSuper ? superFont : baseFont;
                const extraW = ctx.measureText(cm.displayChar).width;
                testExtraSpaceShift += extraW;
                testX += extraW;
              }
              testPrevWasSpace = true;
            } else if (!isSpace && testNonSpaceCounter >= suffixStartNonSpaceIdx && suffixMatchCount > 0) {
              if (!testDeltaXComputed && firstSuffixPdfIdx >= 0 && firstSuffixPdfIdx < pdfNonSpaceChars.length) {
                const firstSuffixPdfX0 = (pdfNonSpaceChars[firstSuffixPdfIdx].x0 - item.pdfX) * scale;
                testDeltaX = testX - firstSuffixPdfX0;
                testDeltaXComputed = true;
              }
              const suffixPdfIdx = pdfNonSpaceChars.length - (lineNonSpaceChars.length - testNonSpaceCounter);
              if (suffixPdfIdx >= 0 && suffixPdfIdx < pdfNonSpaceChars.length) {
                const pdfCh = pdfNonSpaceChars[suffixPdfIdx];
                testX = (pdfCh.x1 - item.pdfX) * scale + testDeltaX;
              } else {
                ctx.font = isSuper ? superFont : baseFont;
                testX += ctx.measureText(cm.displayChar).width;
              }
              testPrevWasSpace = false;
            } else {
              if (i === 0) testX = pStartX;
              ctx.font = isSuper ? superFont : baseFont;
              testX += ctx.measureText(cm.displayChar).width;
              testPrevWasSpace = isSpace;
            }
            if (!isSpace) testNonSpaceCounter++;
          }

          const deficit = (pStartX + pLineTargetW) - testX;
          if (deficit > 0 && deficit < pLineTargetW * 0.45) {
            extraPerSpace = deficit / spaceCount;
          }
        }

        const charXPositions = [];
        let accumX = pStartX;
        let pdfCharIdx = 0;

        let deltaXShift = 0;
        let deltaXShiftComputed = false;

        let nonSpaceCounter = 0;
        let spacesEncountered = 0;
        let extraSpaceShift = 0;
        let prevWasSpace = false;

        for (let i = 0; i < lineChars.length; i++) {
          const cm = lineChars[i];
          const isSpace = cm.origChar === ' ' || cm.origChar === '\u00A0';
          const isSuper = cm.kind === 'super' || cm.kind === 'sub';

          if (!isSpace && pdfCharIdx < prefixMatchCount) {
            // ── PREFIX REGION: exact PDF coordinates + deltaXShift + extraSpaceShift ──
            const pdfCh = pdfNonSpaceChars[pdfCharIdx];
            if (linePrefixStartWordIdx > 0 && !deltaXShiftComputed && pdfCharIdx === 0 && pdfNonSpaceChars.length > 0) {
              const firstPrefixPdfX0 = (pdfNonSpaceChars[0].x0 - item.pdfX) * scale;
              deltaXShift = accumX - firstPrefixPdfX0;
              deltaXShiftComputed = true;
            }
            const pdfX0 = (pdfCh.x0 - item.pdfX) * scale + deltaXShift + extraSpaceShift;
            const pdfX1 = (pdfCh.x1 - item.pdfX) * scale + deltaXShift + extraSpaceShift;
            charXPositions.push(pdfX0);
            accumX = pdfX1;
            pdfCharIdx++;
            prevWasSpace = false;
          } else if (isSpace && pdfCharIdx > 0 && pdfCharIdx < prefixMatchCount) {
            // ── PREFIX SPACE ──
            if (!prevWasSpace) {
              const nextPdfCh = pdfNonSpaceChars[pdfCharIdx];
              const nextPdfX0 = (nextPdfCh.x0 - item.pdfX) * scale + deltaXShift;
              charXPositions.push(accumX);
              accumX = nextPdfX0 + extraSpaceShift + (spacesEncountered * extraPerSpace);
            } else {
              // Extra space bar hit! Shift all subsequent words rightward
              charXPositions.push(accumX);
              ctx.font = isSuper ? superFont : baseFont;
              const extraW = ctx.measureText(cm.displayChar).width + extraPerSpace;
              extraSpaceShift += extraW;
              accumX += extraW;
            }
            spacesEncountered++;
            prevWasSpace = true;
          } else if (!isSpace && nonSpaceCounter >= suffixStartNonSpaceIdx && suffixMatchCount > 0) {
            // ── SUFFIX REGION: PDF x0 + ΔX + justification offset ──
            if (!deltaXShiftComputed && firstSuffixPdfIdx >= 0 && firstSuffixPdfIdx < pdfNonSpaceChars.length) {
              const firstSuffixPdfX0 = (pdfNonSpaceChars[firstSuffixPdfIdx].x0 - item.pdfX) * scale;
              deltaXShift = accumX - firstSuffixPdfX0;
              deltaXShiftComputed = true;
            }
            const suffixPdfIdx = pdfNonSpaceChars.length - (lineNonSpaceChars.length - nonSpaceCounter);
            if (suffixPdfIdx >= 0 && suffixPdfIdx < pdfNonSpaceChars.length) {
              const pdfCh = pdfNonSpaceChars[suffixPdfIdx];
              const shiftedX0 = (pdfCh.x0 - item.pdfX) * scale + deltaXShift;
              const shiftedX1 = (pdfCh.x1 - item.pdfX) * scale + deltaXShift;
              charXPositions.push(shiftedX0);
              accumX = shiftedX1;
            } else {
              charXPositions.push(accumX);
              ctx.font = isSuper ? superFont : baseFont;
              accumX += ctx.measureText(cm.displayChar).width;
            }
            prevWasSpace = false;
          } else {
            // ── MIDDLE / EDITED WORD / SPACES / FALLBACK: canvas-measured accumulation ──
            if (i === 0) accumX = pStartX;
            charXPositions.push(accumX);
            ctx.font = isSuper ? superFont : baseFont;
            let w = ctx.measureText(cm.displayChar).width;
            if (isSpace) {
              w += extraPerSpace;
              spacesEncountered++;
            }
            accumX += w;
            prevWasSpace = isSpace;
          }

          if (!isSpace) nonSpaceCounter++;
        }
        charXPositions.push(accumX);

        if (unitsToPush.length > 1 && accumX > pStartX + pLineTargetW + 1.5) {
          const trimmedUnits = unitsToPush.slice(0, unitsToPush.length - 1);
          const poppedUnit = unitsToPush[unitsToPush.length - 1];

          // Ensure inter-word space is preserved between popped unit and next line's units
          const lastPoppedChar = poppedUnit.chars[poppedUnit.chars.length - 1]?.origChar;
          const firstOverflowChar = overflowUnitsFromPrevLine[0]?.chars[0]?.origChar;
          if (lastPoppedChar !== ' ' && lastPoppedChar !== '\u00A0' &&
              firstOverflowChar && firstOverflowChar !== ' ' && firstOverflowChar !== '\u00A0') {
            const spaceMeta = { origChar: ' ', displayChar: ' ', kind: 'normal', charIndex: -1 };
            const spaceUnit = { chars: [spaceMeta], width: ctx.measureText(' ').width };
            overflowUnitsFromPrevLine = [poppedUnit, spaceUnit, ...overflowUnitsFromPrevLine];
          } else {
            overflowUnitsFromPrevLine = [poppedUnit, ...overflowUnitsFromPrevLine];
          }

          return pushLine(trimmedUnits, isLastCanvasLineOfBlock);
        }

        const yTop = lineIdx * lineHeightPx;
        const yBaseline = yTop + ascenderPx;

        lines.push({
          lineIndex: lineIdx,
          text: lineStr,
          chars: lineChars,
          charStartOffset: lineChars[0]?.charIndex ?? 0,
          charEndOffset: (lineChars[lineChars.length - 1]?.charIndex ?? 0) + 1,
          charXPositions,
          startX: pStartX,
          targetWidth: pLineTargetW,
          extraPerSpace,
          width: accumX - pStartX,
          yTop,
          yBaseline,
          lineHeightPx
        });
      };

      for (let uIdx = 0; uIdx < allUnitsForLine.length; uIdx++) {
        const unit = allUnitsForLine[uIdx];
        const isFirstInLine = currentLineUnits.length === 0;

        if (currentLineWidth + unit.width <= pLineTargetW || isFirstInLine) {
          currentLineUnits.push(unit);
          currentLineWidth += unit.width;
        } else {
          // Unit exceeds target width of current line — push remaining units to overflow for next line!
          overflowUnitsFromPrevLine = allUnitsForLine.slice(uIdx);
          break;
        }
      }

      if (currentLineUnits.length > 0 || allUnitsForLine.length === 0) {
        pushLine(currentLineUnits, overflowUnitsFromPrevLine.length === 0);
      }

      if (pIdx < rawLinesText.length) {
        globalCharOffset += pText.length + 1; // +1 for \n
      }
    }

    // ── Build 100% Strict Global Spatial Character Map (Array length MUST = text.length + 1) ──
    const globalCharMap = new Array(text.length + 1);

    lines.forEach((lineObj, lineIdx) => {
      const lineChars = lineObj.chars || [];
      const charXPositions = lineObj.charXPositions || [];

      // Map each character in the current line using its authoritative cm.charIndex
      lineChars.forEach((cm, localIdx) => {
        if (cm && cm.charIndex >= 0 && cm.charIndex < text.length) {
          const xPos = charXPositions[localIdx] != null ? charXPositions[localIdx] : lineObj.startX;
          globalCharMap[cm.charIndex] = {
            x: xPos,
            yTop: lineObj.yTop,
            yBaseline: lineObj.yBaseline,
            lineHeightPx: lineObj.lineHeightPx,
            lineIndex: lineIdx
          };
        }
      });

      // Handle line end boundary / newline index mapping
      if (lineChars.length > 0) {
        const endX = charXPositions[lineChars.length] != null 
          ? charXPositions[lineChars.length] 
          : lineObj.startX + lineObj.width;

        const lastCm = lineChars[lineChars.length - 1];
        if (lastCm && lastCm.charIndex >= 0) {
          const endCharIdx = lastCm.charIndex + 1;
          if (endCharIdx <= text.length && !globalCharMap[endCharIdx]) {
            globalCharMap[endCharIdx] = {
              x: endX,
              yTop: lineObj.yTop,
              yBaseline: lineObj.yBaseline,
              lineHeightPx: lineObj.lineHeightPx,
              lineIndex: lineIdx
            };
          }
        }
      }
    });

    // Fill any missing unmapped indices by interpolating from adjacent mapped indices
    let lastValidPos = { x: 0, yTop: 0, yBaseline: ascenderPx, lineHeightPx, lineIndex: 0 };
    for (let idx = 0; idx <= text.length; idx++) {
      if (globalCharMap[idx]) {
        lastValidPos = globalCharMap[idx];
      } else {
        globalCharMap[idx] = { ...lastValidPos };
      }
    }

    // Map final cursor position (after last character of text)
    const lastLine = lines[lines.length - 1];
    const finalX = (lastLine && lastLine.charXPositions)
      ? (lastLine.charXPositions[lastLine.chars.length] || lastLine.startX + lastLine.width)
      : 0;

    globalCharMap[text.length] = {
      x: finalX,
      yTop: lastLine ? lastLine.yTop : 0,
      yBaseline: lastLine ? lastLine.yBaseline : 0,
      lineHeightPx: lastLine ? lastLine.lineHeightPx : lineHeightPx,
      lineIndex: lines.length - 1
    };

    const nativeDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(nativeDpr * SUPERSAMPLE_FACTOR, MAX_EFFECTIVE_DPR);
    return { lines, baseFont, superFont, ascenderPx, lineHeightPx, globalCharMap, dpr };
  }, [text, initialRanges, origLines, item, scale, baseFontSizePx, currentFontFamily, isBold, isItalic, blockAlign, getOrigLineBounds, r.h]);

  /**
   * Sequential X-Advance Tracking & Superscript Y-Elevation rendering per line
   */
  const drawCanvasLine = useCallback((ctx, line, layout, fontSizePx, defaultColor) => {
    let currentX = line.startX || 0;
    const dpr = layout?.dpr || Math.min((window.devicePixelRatio || 1) * SUPERSAMPLE_FACTOR, MAX_EFFECTIVE_DPR);

    for (let i = 0; i < line.chars.length; i++) {
      const cm = line.chars[i];
      const isSuper = cm.kind === 'super';
      const isSub = cm.kind === 'sub';

      ctx.font = (isSuper || isSub) ? layout.superFont : layout.baseFont;
      ctx.fillStyle = cm.color || defaultColor || '#000000';

      // Dual-baseline vertical elevation offset:
      // Superscript: -0.32 * fontSizePx
      // Subscript: +0.15 * fontSizePx
      let yPos = line.yBaseline;
      if (isSuper) {
        yPos = line.yBaseline - (0.32 * fontSizePx);
      } else if (isSub) {
        yPos = line.yBaseline + (0.15 * fontSizePx);
      }

      const rawX = (line.charXPositions && line.charXPositions[i] != null) ? line.charXPositions[i] : currentX;
      
      // Snap to exact device pixel boundary for crystal-clear, non-blurry text rendering
      const crispX = Math.round(rawX * dpr) / dpr;
      const crispY = Math.round(yPos * dpr) / dpr;

      ctx.fillText(cm.displayChar, crispX, crispY);

      if (!isBold) {
        const glyphFontSizePx = (isSuper || isSub) ? fontSizePx * 0.65 : fontSizePx;
        const stemVwRatio = getFontStemVwRatio(currentFontFamily);
        const darken = getStemDarkeningPx(glyphFontSizePx, stemVwRatio);
        if (darken > 0) {
          ctx.lineWidth = darken;
          ctx.strokeStyle = cm.color || defaultColor || '#000000';
          ctx.strokeText(cm.displayChar, crispX, crispY);
        }
      }

      const charW = ctx.measureText(cm.displayChar).width;
      const extra = (line.extraPerSpace && (cm.origChar === ' ' || cm.origChar === '\u00A0')) ? line.extraPerSpace : 0;
      currentX = rawX + charW + extra;
    }
  }, [isBold, currentFontFamily]);

  const coverageRef = useRef(null);

  /**
   * Render Canvas Loop with Dynamic Height Auto-Expansion
   */
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Temporary Layout Pass to determine total required height
    const initialLayout = computeLineLayout(ctx);
    const requiredHeightPx = Math.max(r.h, initialLayout.lines.length * initialLayout.lineHeightPx);
    const deltaH = requiredHeightPx - r.h;

    if (onHeightChange) {
      onHeightChange(item.pdfY, deltaH);
    }

    const nativeDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(nativeDpr * SUPERSAMPLE_FACTOR, MAX_EFFECTIVE_DPR);
    const canvasW = Math.max(1, Math.round(r.w * dpr));
    const canvasH = Math.max(1, Math.round(requiredHeightPx * dpr));

    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.width = `${r.w}px`;
    canvas.style.height = `${requiredHeightPx}px`;

    if (coverageRef.current) {
      coverageRef.current.style.height = `${requiredHeightPx}px`;
    }

    ctx.scale(dpr, dpr);
    ctx.textRendering = 'geometricPrecision';

    // 2. Clear & Fill Solid White Background Fill
    ctx.clearRect(0, 0, r.w, requiredHeightPx);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, r.w, requiredHeightPx);

    // 3. Compute Final Layout
    const layout = computeLineLayout(ctx);
    canvas._layout = { ...layout, dpr };

    // 4. Selection Highlight Rectangles (rgba(147, 197, 253, 0.6))
    if (selection.start !== selection.end) {
      const minSel = Math.min(selection.start, selection.end);
      const maxSel = Math.max(selection.start, selection.end);
      ctx.fillStyle = 'rgba(147, 197, 253, 0.6)';

      for (const line of layout.lines) {
        if (line.charEndOffset <= minSel || line.charStartOffset >= maxSel) continue;

        const localStart = Math.max(0, minSel - line.charStartOffset);
        const localEnd = Math.min(line.text.length, maxSel - line.charStartOffset);

        const xStart = line.charXPositions[localStart] || 0;
        const xEnd = line.charXPositions[localEnd] || 0;

        ctx.fillRect(xStart, line.yTop, Math.max(1, xEnd - xStart), line.lineHeightPx);
      }
    }

    // 5. Formatted Line Text & Dual-Baseline Superscripts
    for (const line of layout.lines) {
      drawCanvasLine(ctx, line, layout, baseFontSizePx, color);
    }

    // 6. 2px Smooth Blinking Caret Bar via Global Spatial Character Map
    if (isFocused && selection.start === selection.end && caretVisible) {
      const targetOffset = selection.start;
      const caretPos = (layout.globalCharMap && layout.globalCharMap[targetOffset])
        ? layout.globalCharMap[targetOffset]
        : (layout.globalCharMap ? layout.globalCharMap[layout.globalCharMap.length - 1] : null);

      if (caretPos) {
        ctx.fillStyle = color || '#000000';
        ctx.fillRect(Math.floor(caretPos.x), caretPos.yTop, 2, caretPos.lineHeightPx);
      }
    }
  }, [r.w, r.h, computeLineLayout, selection, drawCanvasLine, baseFontSizePx, color, isFocused, caretVisible, item.pdfY, onHeightChange]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  /**
   * Spatial Hit Testing: Mouse click / drag -> lineIndex & charIndex mapping
   */
  const getCharOffsetFromPoint = useCallback((clickX, clickY) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas._layout) return text.length;

    const layout = canvas._layout;
    if (!layout.lines || layout.lines.length === 0) return 0;

    // Exact vertical line bounding box lookup (yMin to yMax)
    let targetLine = layout.lines[0];
    for (let l = 0; l < layout.lines.length; l++) {
      const line = layout.lines[l];
      const yMin = line.yTop;
      const yMax = line.yTop + line.lineHeightPx;
      if (clickY >= yMin && clickY < yMax) {
        targetLine = line;
        break;
      }
      if (clickY >= yMax) {
        targetLine = line;
      }
    }

    // Horizontal char position lookup
    const charX = targetLine.charXPositions;
    const lineChars = targetLine.chars || [];
    const len = targetLine.text.length;

    if (len === 0) return targetLine.charStartOffset;

    const firstCm = lineChars[0];
    const firstOffset = (firstCm && firstCm.charIndex >= 0) ? firstCm.charIndex : targetLine.charStartOffset;

    const lastCm = lineChars[len - 1];
    const lastOffset = (lastCm && lastCm.charIndex >= 0) ? lastCm.charIndex + 1 : targetLine.charEndOffset;

    if (clickX <= charX[0]) return firstOffset;
    if (clickX >= charX[len]) return lastOffset;

    for (let i = 0; i < len; i++) {
      const xLeft = charX[i];
      const xRight = charX[i + 1];
      const xMid = (xLeft + xRight) / 2;

      if (clickX < xMid) {
        const cm = lineChars[i];
        return (cm && cm.charIndex >= 0) ? cm.charIndex : (targetLine.charStartOffset + i);
      }
    }
    return lastOffset;
  }, [text.length]);

  /**
   * Mouse Pointer Event Handlers
   */
  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const offset = getCharOffsetFromPoint(clickX, clickY);
    dragAnchorRef.current = offset;
    isDraggingRef.current = true;

    setSelection({ start: offset, end: offset });
    setCaretVisible(true);

    if (textareaRef.current) {
      isProgrammaticSelectionRef.current = true;
      // setTimeout(0): defer focus() until AFTER the mousedown event cycle.
      // This is the standard pattern used by ProseMirror/Fabric.js to prevent
      // the browser from firing blur on the textarea due to the canvas click.
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(offset, offset);
        }
        // Clear suppression flag after focus has settled
        setTimeout(() => { isProgrammaticSelectionRef.current = false; }, 100);
      }, 0);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const focusOffset = getCharOffsetFromPoint(clickX, clickY);
    const anchor = dragAnchorRef.current;

    const selStart = Math.min(anchor, focusOffset);
    const selEnd = Math.max(anchor, focusOffset);

    setSelection({ start: selStart, end: selEnd });

    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(selStart, selEnd);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  /**
   * Keydown Event Handling for offscreen textarea
   */
  const handleKeyDown = (e) => {
    e.stopPropagation();
    setCaretVisible(true);

    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    if (!item.isParagraph && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
      return;
    }

    // Intercept vertical arrow key navigation across canvas lines
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const canvas = canvasRef.current;
      if (canvas && canvas._layout && canvas._layout.lines.length > 1) {
        e.preventDefault();
        const layout = canvas._layout;
        const currentOffset = textareaRef.current.selectionEnd;

        // Current line lookup
        let currentLineIdx = 0;
        for (const line of layout.lines) {
          if (currentOffset >= line.charStartOffset && currentOffset <= line.charEndOffset) {
            currentLineIdx = line.lineIndex;
            break;
          }
        }

        const currentLine = layout.lines[currentLineIdx];
        const localCharIdx = currentOffset - currentLine.charStartOffset;
        const currentX = currentLine.charXPositions[localCharIdx] || 0;

        const targetLineIdx = e.key === 'ArrowUp'
          ? Math.max(0, currentLineIdx - 1)
          : Math.min(layout.lines.length - 1, currentLineIdx + 1);

        const targetLine = layout.lines[targetLineIdx];
        const targetOffset = getCharOffsetFromPoint(currentX, targetLine.yTop + 2);

        if (e.shiftKey) {
          const anchor = selection.start;
          const newStart = Math.min(anchor, targetOffset);
          const newEnd = Math.max(anchor, targetOffset);
          setSelection({ start: newStart, end: newEnd });
          textareaRef.current.setSelectionRange(newStart, newEnd);
        } else {
          setSelection({ start: targetOffset, end: targetOffset });
          textareaRef.current.setSelectionRange(targetOffset, targetOffset);
        }
      }
    }
  };

  /**
   * Commit Edit Payload to pdfEditStore & Parent Callback
   */
  const handleCommit = () => {
    const cleanText = sanitizeForCommit(text);
    const origLines = item?.origLines || (Array.isArray(item?.lines) && item.lines[0]?.chars ? item.lines : null) || item?.blockData?.origLines;
    const { charMeta } = parseCharMetadata(text, initialRanges, origLines);
    const newRanges = extractRangesFromCharMeta(charMeta);

    const canvas = canvasRef.current;
    let computedLines = [];
    if (canvas && canvas._layout && canvas._layout.lines) {
      computedLines = canvas._layout.lines.map(l => l.text);
    }

    onCommit(
      cleanText,
      { fontSizeAdj, color, fontFamily, isBold, isItalic, lines: computedLines },
      newRanges
    );
  };

  // Keep handleCommitRef pointing at the latest handleCommit (avoid stale closure in document listener)
  useEffect(() => { handleCommitRef.current = handleCommit; });

  return (
    // Zero-footprint wrapper div: needed so document.mousedown outside-click
    // detection can use container.contains(e.target) for all editor children.
    // display:contents makes the div invisible to CSS layout (no positioning
    // context created), so children remain positioned relative to the Viewer
    // page container — exactly as they were in the Fragment.
    <div
      ref={editorContainerRef}
      style={{ display: 'contents' }}
    >
      {/* Floating Toolbar Controls */}
      <div
        style={{
          position: 'absolute',
          left: r.x,
          top: Math.max(0, r.y - 70 - keyboardOffset),
          zIndex: 102,
          width: 'max-content'
        }}
        className="flex flex-col bg-white border border-gray-300 rounded-md shadow-lg pointer-events-auto divide-y divide-gray-200"
        onPointerDown={e => e.preventDefault()}
        onMouseDown={e => e.preventDefault()}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-2 py-1 text-[10px] bg-gray-50 rounded-t-md flex items-center justify-between gap-3">
          <span className="font-mono text-gray-600">Font: {stripSubset(item.fontPostScriptName || item.fontName) || 'Default'}</span>
          {isFontEmbeddedAndActive ? (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded flex items-center gap-1" title="Using exact embedded font from PDF file">
              ✓ Embedded
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded flex items-center gap-1" title="Using browser fallback font">
              ⚠ Fallback
            </span>
          )}
          <span className="text-gray-500">{Math.round(item.fontSize)}px</span>
        </div>
        <div className="flex gap-1 p-1 items-center">
          <select
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value)}
            className="text-xs border border-gray-300 rounded px-1 py-1 outline-none hover:border-blue-400"
            onPointerDown={e => e.stopPropagation()}
          >
            {FONTS.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
            title="Text Color"
            onPointerDown={e => e.stopPropagation()}
          />

          <div className="w-px h-4 bg-gray-300 mx-1"></div>

          <button
            onClick={() => setIsBold(!isBold)}
            className={`w-6 h-6 flex items-center justify-center text-sm font-bold rounded ${isBold ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            title="Bold"
            onPointerDown={e => e.preventDefault()}
          >
            B
          </button>
          <button
            onClick={() => setIsItalic(!isItalic)}
            className={`w-6 h-6 flex items-center justify-center text-sm italic rounded ${isItalic ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            title="Italic"
            onPointerDown={e => e.preventDefault()}
          >
            I
          </button>

          <div className="w-px h-4 bg-gray-300 mx-1"></div>

          <button
            onClick={() => setFontSizeAdj(v => v - 1)}
            className="px-1.5 py-1 text-xs font-semibold hover:bg-gray-100 rounded"
            title="Smaller"
            onPointerDown={e => e.preventDefault()}
          >
            A-
          </button>
          <button
            onClick={() => setFontSizeAdj(v => v + 1)}
            className="px-1.5 py-1 text-xs font-semibold hover:bg-gray-100 rounded"
            title="Larger"
            onPointerDown={e => e.preventDefault()}
          >
            A+
          </button>

          <div className="w-px h-4 bg-gray-300 mx-1"></div>

          <button
            onClick={handleCommit}
            className="px-2 py-1 text-xs text-blue-600 font-medium hover:bg-blue-50 rounded"
            onPointerDown={e => e.preventDefault()}
          >
            Done
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 rounded"
            onPointerDown={e => e.preventDefault()}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Solid White Coverage Rectangle hiding underlying PDF text */}
      <div
        ref={coverageRef}
        style={{
          position: 'absolute',
          left: r.x,
          top: r.y,
          width: r.w,
          height: r.h,
          backgroundColor: '#ffffff',
          zIndex: 99,
          pointerEvents: 'none',
        }}
      />

      {/* HTML5 Canvas Surface */}
      <canvas
        ref={canvasRef}
        className="canvas-inline-editor"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: r.x,
          top: r.y,
          width: `${r.w}px`,
          height: `${r.h}px`,
          zIndex: 100,
          cursor: 'text',
          border: '1px dashed rgba(148, 163, 184, 0.8)',
          backgroundColor: '#ffffff',
          transform: keyboardOffset ? `translateY(${-keyboardOffset}px)` : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Hidden Offscreen Textarea Bridge */}
      <textarea
        ref={textareaRef}
        defaultValue={textRef.current}
        onChange={e => {
          isTypingRef.current = true;
          const newText = e.target.value;
          const newStart = e.target.selectionStart;
          const newEnd = e.target.selectionEnd;

          textRef.current = newText;
          selectionRef.current = { start: newStart, end: newEnd };

          setText(newText);
          setSelection({ start: newStart, end: newEnd });
          setCaretVisible(true);

          requestAnimationFrame(() => {
            isTypingRef.current = false;
          });
        }}
        onSelect={e => {
          if (isTypingRef.current || isProgrammaticSelectionRef.current) return;
          const newStart = e.target.selectionStart;
          const newEnd = e.target.selectionEnd;

          selectionRef.current = { start: newStart, end: newEnd };

          setSelection({ start: newStart, end: newEnd });
          setCaretVisible(true);
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          // If a programmatic click-to-reposition is in progress, ignore blur entirely.
          if (isProgrammaticSelectionRef.current) return;
          // For keyboard-triggered focus loss (Tab, Alt+Tab): relatedTarget is non-null.
          // Check if focus moved to another editor element (toolbar button etc.).
          const related = e.relatedTarget;
          const container = editorContainerRef.current;
          if (related && container && container.contains(related)) return;
          // True focus exit via keyboard — commit.
          // Mouse-triggered exits are handled by the document mousedown listener above.
          if (related !== null) {
            setIsFocused(false);
            handleCommit();
          }
          // related === null means a canvas click triggered this blur.
          // The document mousedown listener will handle commit if needed.
          // Just update visual state.
          setIsFocused(false);
        }}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          position: 'absolute',
          top: `${r.y}px`,
          left: `${r.x}px`,
          width: '1px',
          height: '1px',
          opacity: 0,
          overflow: 'hidden',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
