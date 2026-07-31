import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { pdfToScreen } from '../../utils/pdfCoords';
import { SUPER_MAP, UNICODE_SUPER_MAP, UNICODE_SUB_MAP, normalizeText } from './superscriptUtils';

const rgbToHex = (colorStr) => {
  if (!colorStr) return '#000000';
  if (colorStr.startsWith('#')) return colorStr;
  const match = colorStr.match(/\d+/g);
  if (!match || match.length < 3) return '#000000';
  return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
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
    let bIdx = 0;
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
        // If backendChars[bIdx] is also whitespace, advance bIdx
        if (bIdx < backendChars.length && /\s/.test(backendChars[bIdx].c)) {
          bIdx++;
        }
        continue;
      }

      if (bIdx < backendChars.length) {
        const ch = backendChars[bIdx];
        const kind = ch.is_superscript ? 'super' : (ch.is_subscript ? 'sub' : 'normal');
        const displayChar = SUPER_MAP[ch.c] || ch.c;
        const origChar = SUPER_MAP[ch.c] || ch.c;
        const color = ch.color || undefined;

        cleanChars.push(origChar);
        charMeta.push({
          origChar,
          displayChar,
          kind,
          color,
          charIndex: i
        });
        bIdx++;
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

export function CanvasInlineEditor({ item, scale, existingEdit, onCommit, onCancel }) {
  const getInitialText = useCallback(() => {
    if (existingEdit && existingEdit.newStr) return existingEdit.newStr;
    if (item.lines && item.lines.length > 0) {
      return item.lines.map(l => (typeof l === 'string' ? l : (l?.text || l))).join('\n');
    }
    if (item.rawPdfLines && item.rawPdfLines.length > 0) return item.rawPdfLines.join('\n');
    return item.str || item.text || '';
  }, [existingEdit, item]);

  // Extract spans from item or blockData if available
  const spans = useMemo(() => {
    if (item.spans && Array.isArray(item.spans) && item.spans.length > 0) return item.spans;
    if (item.blockData?.spans && Array.isArray(item.blockData.spans) && item.blockData.spans.length > 0) return item.blockData.spans;
    if (item.lines && Array.isArray(item.lines)) {
      const res = [];
      for (const l of item.lines) {
        if (l && typeof l === 'object' && Array.isArray(l.spans)) {
          res.push(...l.spans);
        }
      }
      if (res.length > 0) return res;
    }
    return null;
  }, [item]);

  const rawInitialStr = getInitialText();
  const rawInitialRanges = existingEdit ? existingEdit.superscriptRanges || [] : item.superscriptRanges || [];
  const origLines = item?.origLines || (Array.isArray(item?.lines) && item.lines[0]?.chars ? item.lines : null) || item?.blockData?.origLines;
  const initialParsed = useMemo(() => parseCharMetadata(rawInitialStr, rawInitialRanges, origLines), [rawInitialStr, rawInitialRanges, origLines]);
  const initialStr = initialParsed.cleanText;
  const initialRanges = useMemo(() => extractRangesFromCharMeta(initialParsed.charMeta), [initialParsed.charMeta]);

  // Text state
  const [text, setText] = useState(initialStr);
  const [selection, setSelection] = useState(() => ({ start: initialStr.length, end: initialStr.length }));
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [caretVisible, setCaretVisible] = useState(true);

  // Formatting state
  const [fontSizeAdj, setFontSizeAdj] = useState(existingEdit ? existingEdit.fontSizeAdj : 0);
  const [color, setColor] = useState(() => existingEdit?.color || rgbToHex(item.color) || '#000000');
  const [fontFamily, setFontFamily] = useState(() => existingEdit?.customFontFamily || 'Original');
  const [isBold, setIsBold] = useState(() => (existingEdit ? existingEdit.isBold : item.isBold === true));
  const [isItalic, setIsItalic] = useState(() => (existingEdit ? existingEdit.isItalic : item.isItalic === true));

  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const canvasRef = useRef(null);
  const textareaRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragAnchorRef = useRef(0);

  const r = pdfToScreen(item, scale);
  const baseFontSizePx = Math.max(8, Math.round(item.fontSize * scale) + fontSizeAdj);
  // Authoritative block alignment from PyMuPDF (passed through Viewer.jsx → item.align)
  const blockAlign = item.align || 'left';

  // Build Font Stack
  const fontCandidates = [
    item.fontPostScriptName,
    stripSubset(item.fontPostScriptName),
    item.fontName,
    stripSubset(item.fontName),
  ].filter(Boolean);
  const uniqueCandidates = [...new Set(fontCandidates)];
  const sanitizedCandidates = uniqueCandidates.map(sanitizeFontName);
  const realFontStack = sanitizedCandidates.map(n => `"${n}"`).join(', ');

  const currentFontFamily = fontFamily === 'Original'
    ? (item.renderedFontFamily || `${realFontStack}, "Times New Roman", Georgia, serif`)
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
    let x1 = null;
    if (origLine && typeof origLine === 'object') {
      x0 = origLine.line_x0 ?? origLine.pdfX ?? (Array.isArray(origLine.bbox) ? origLine.bbox[0] : null);
      x1 = origLine.line_x1 ?? (origLine.pdfW != null ? ((origLine.pdfX ?? x0) + origLine.pdfW) : (origLine.width != null ? ((origLine.pdfX ?? x0) + origLine.width) : (Array.isArray(origLine.bbox) ? origLine.bbox[2] : null)));
    }
    if (x0 == null) {
      x0 = item.pdfX + (lineIdx === 0 && item.textIndent ? item.textIndent : 0);
    }
    if (x1 == null) {
      x1 = item.pdfX + (item.pdfW || r.w / scale);
    }
    return { line_x0: x0, line_x1: x1 };
  }, [item.pdfX, item.pdfW, item.textIndent, r.w, scale]);

  /**
   * Layout Engine: Breaks text into lines, applies Atomic Citation Unit binding,
   * measures character X offsets, and calculates dual-baseline vertical positions.
   */
  const computeLineLayout = useCallback((ctx) => {
    const origLines = item?.origLines || (Array.isArray(item?.lines) && item.lines[0]?.chars ? item.lines : null) || item?.blockData?.origLines;
    const { charMeta } = parseCharMetadata(text, initialRanges, origLines);
    const boxWidth = Math.max(1, r.w);

    // Font specs
    const baseFont = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${baseFontSizePx}px ${currentFontFamily}`;
    const superFont = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${Math.round(baseFontSizePx * 0.65)}px ${currentFontFamily}`;

    // Map character index to span info if spans exist
    const pdfX = item.pdfX ?? (item.bbox ? item.bbox[0] : 0);
    const charSpanMap = new Array(text.length).fill(null);

    if (spans && spans.length > 0) {
      let searchPos = 0;
      for (const span of spans) {
        const spanTxt = span.text || span.str || '';
        if (!spanTxt) continue;

        let idx = text.indexOf(spanTxt, searchPos);
        if (idx === -1) {
          idx = text.toLowerCase().indexOf(spanTxt.toLowerCase(), searchPos);
        }

        if (idx !== -1) {
          const spanBboxX0 = Array.isArray(span.bbox) ? span.bbox[0] : (span.x0 ?? null);
          const relX = spanBboxX0 != null ? (spanBboxX0 - pdfX) * scale : null;
          const isSuper = Boolean(
            (span.flags && (span.flags & 1) !== 0) ||
            span.is_superscript === true ||
            span.kind === 'super' ||
            span.kind === 'sup'
          );

          for (let k = 0; k < spanTxt.length; k++) {
            const charIdx = idx + k;
            if (charIdx < text.length) {
              charSpanMap[charIdx] = {
                span,
                relX,
                isFirstInSpan: k === 0,
                isSuper,
                fontSize: span.size || span.fontSize
              };
            }
          }
          searchPos = idx + spanTxt.length;
        }
      }
    }

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
    } catch (e) {}

    // Calculate line height
    const estimatedLineHeight = item.lineHeight ? item.lineHeight * scale : baseFontSizePx * 1.2;
    const targetLineCount = Math.max(1, Math.round(r.h / estimatedLineHeight));
    const lineHeightPx = (item.isParagraph && r.h > 0) ? (r.h / targetLineCount) : estimatedLineHeight;

    // Hard paragraph line breaks
    const rawLinesText = text.split('\n');
    const lines = [];
    let globalCharOffset = 0;

    for (let pIdx = 0; pIdx < rawLinesText.length; pIdx++) {
      const pText = rawLinesText[pIdx];
      const pMeta = charMeta.slice(globalCharOffset, globalCharOffset + pText.length);

      // Tokenize paragraph into words / whitespace / superscripts
      // Atomic Citation Unit: A word + immediately following superscript chars are bound together
      const units = [];
      let currentUnitChars = [];

      for (let i = 0; i < pMeta.length; i++) {
        const cm = pMeta[i];
        currentUnitChars.push(cm);

        const isLastInP = i === pMeta.length - 1;
        const nextIsSpace = !isLastInP && (pMeta[i + 1].origChar === ' ' || pMeta[i + 1].origChar === '\t');
        const currIsSpace = cm.origChar === ' ' || cm.origChar === '\t';
        const currIsCJK = isCJKChar(cm.origChar);
        const nextIsCJK = !isLastInP && isCJKChar(pMeta[i + 1].origChar);

        // Break unit if at end of paragraph, whitespace, next char is whitespace, or CJK boundary
        if (isLastInP || currIsSpace || nextIsSpace || currIsCJK || nextIsCJK) {
          // If current char is NOT a space, and next char is super, keep super bound to anchor word/character
          if (!currIsSpace && !isLastInP && pMeta[i + 1].kind === 'super') {
            continue;
          }
          // Compute unit width
          let unitWidth = 0;
          for (const ucm of currentUnitChars) {
            ctx.font = (ucm.kind === 'super' || ucm.kind === 'sub') ? superFont : baseFont;
            unitWidth += ctx.measureText(ucm.displayChar).width;
          }
          units.push({ chars: currentUnitChars, width: unitWidth });
          currentUnitChars = [];
        }
      }

      if (currentUnitChars.length > 0) {
        let unitWidth = 0;
        for (const ucm of currentUnitChars) {
          ctx.font = (ucm.kind === 'super' || ucm.kind === 'sub') ? superFont : baseFont;
          unitWidth += ctx.measureText(ucm.displayChar).width;
        }
        units.push({ chars: currentUnitChars, width: unitWidth });
      }

      // ── Per-pIdx PyMuPDF line bounds ──────────────────────────────────────────
      // Compute bounds ONCE for this paragraph block (pIdx). With \n separators,
      // pIdx maps 1:1 to origLines[pIdx]. ALL canvas lines produced within this
      // pIdx block use pStartX and pTargetWidth from this origLine, guaranteeing
      // that the correct PyMuPDF coordinates drive both wrapping and justification.
      const isLastPdfLine = pIdx === rawLinesText.length - 1;
      const pOrigLine = (origLines && Array.isArray(origLines) && origLines[pIdx]) ? origLines[pIdx] : null;
      const { line_x0: pLX0, line_x1: pLX1 } = getOrigLineBounds(pOrigLine, pIdx);
      const pLineTargetW = Math.max(1, (pLX1 - pLX0) * scale);
      const pStartX = (pLX0 - item.pdfX) * scale;

      // Line wrapping algorithm
      let currentLineUnits = [];
      let currentLineWidth = 0;
      let lineCharStart = globalCharOffset;

      const pushLine = (lineUnits, isLastCanvasLineOfBlock = false) => {
        const lineChars = lineUnits.flatMap(u => u.chars);
        const lineStr = lineChars.map(c => c.origChar).join('');
        const lineIndex = lines.length;

        // All canvas lines within this pIdx block share the same startX and targetWidth
        // derived from origLines[pIdx] — the authoritative PyMuPDF coordinate.
        const startX = pStartX;
        const targetWidth = pLineTargetW;

        // Justify all canvas lines EXCEPT the very last line of the entire paragraph
        // (isLastPdfLine && isLastCanvasLineOfBlock). Intermediate PDF lines are always
        // justified — even if they are the last canvas line of their \n-block.
        const isLastLineOfParagraph = isLastPdfLine && isLastCanvasLineOfBlock;

        // ── Direct PyMuPDF char coordinate approach ─────────────────────────────
        // When pOrigLine.chars is available and the non-space character count matches
        // lineChars, we use PyMuPDF's exact x0/x1 per-character coordinates directly.
        // This gives pixel-perfect positioning matching the PDF for all lines,
        // including the last line where browser font metrics would otherwise cause
        // the text to fall short of the right edge (superscripts, last words, etc.).
        const pdfChars = pOrigLine?.chars || [];
        // PyMuPDF includes space glyphs in some lines (e.g. between citation spans
        // like "³³ ³⁵ ³⁶"). Filter them out so the count comparison matches
        // nonSpaceCount, otherwise usePdfCoords would incorrectly be false for
        // those lines and fall back to browser measurement (which is too narrow).
        const pdfNonSpaceChars = pdfChars.filter(ch => {
          const c = ch.c ?? ch.char ?? '';
          return c !== ' ' && c !== '\u00A0' && c.length > 0;
        });
        const nonSpaceCount = lineChars.filter(
          cm => cm.origChar !== ' ' && cm.origChar !== '\u00A0'
        ).length;
        const usePdfCoords = pdfNonSpaceChars.length > 0 && pdfNonSpaceChars.length === nonSpaceCount;

        // Build extraPerSpace only when NOT using direct PDF coordinates.
        // When usePdfCoords=true, justification is already encoded in the char x0 positions.
        const shouldJustify = (item.align === 'justify' || item.isJustified ||
          (item.isParagraph && blockAlign === 'justify'));
        const spaceCount = lineChars.filter(cm => cm.origChar === ' ' || cm.origChar === '\u00A0').length;

        let extraPerSpace = 0;
        if (!usePdfCoords && shouldJustify && !isLastLineOfParagraph && spaceCount > 0) {
          let rawLineWidth = 0;
          for (const cm of lineChars) {
            ctx.font = (cm.kind === 'super' || cm.kind === 'sub') ? superFont : baseFont;
            rawLineWidth += ctx.measureText(cm.displayChar).width;
          }
          const deficit = targetWidth - rawLineWidth;
          if (deficit > 0) extraPerSpace = deficit / spaceCount;
        }

        // ── Build charXPositions ─────────────────────────────────────────────────
        // charXPositions[i] = canvas X of the start of char i
        // charXPositions[N] = canvas X after the last char
        const charXPositions = [];
        let accumX = startX;
        let pdfCharIdx = 0;

        for (let i = 0; i < lineChars.length; i++) {
          const cm = lineChars[i];
          const isSpace = cm.origChar === ' ' || cm.origChar === '\u00A0';
          const isSuper = cm.kind === 'super' || cm.kind === 'sub';

          if (usePdfCoords && !isSpace && pdfCharIdx < pdfNonSpaceChars.length) {
            // ── Direct PDF coordinate path ───────────────────────────────────────
            const pdfCh = pdfNonSpaceChars[pdfCharIdx];
            const pdfX0 = (pdfCh.x0 - item.pdfX) * scale;
            const pdfX1 = (pdfCh.x1 - item.pdfX) * scale;
            charXPositions.push(pdfX0);  // exact PDF start position
            accumX = pdfX1;              // advance to PDF end position
            pdfCharIdx++;
          } else {
            // ── Fallback: browser measurement path ───────────────────────────────
            // Used for space chars, edited text, or when PDF coords aren't available.
            // For the first char of a line, anchor to startX.
            if (i === 0) accumX = startX;
            charXPositions.push(accumX);
            ctx.font = isSuper ? superFont : baseFont;
            let w = ctx.measureText(cm.displayChar).width;
            if (isSpace && extraPerSpace > 0) w += extraPerSpace;
            accumX += w;
          }
        }
        charXPositions.push(accumX); // position after last char

        const yTop = lineIndex * lineHeightPx;
        const yBaseline = yTop + ascenderPx;

        lines.push({
          lineIndex,
          text: lineStr,
          chars: lineChars,
          charStartOffset: lineCharStart,
          charEndOffset: lineCharStart + lineChars.length,
          charXPositions,
          startX,
          targetWidth,
          extraPerSpace,
          width: accumX - startX,
          yTop,
          yBaseline,
          lineHeightPx
        });

        lineCharStart += lineChars.length;
      };

      for (const unit of units) {
        if (!item.isParagraph) {
          // Single line item does not wrap
          currentLineUnits.push(unit);
          currentLineWidth += unit.width;
        } else {
          // Paragraph item wraps at pIdx's PyMuPDF line width
          if (currentLineWidth + unit.width <= pLineTargetW) {
            currentLineUnits.push(unit);
            currentLineWidth += unit.width;
          } else if (unit.width <= pLineTargetW) {
            if (currentLineUnits.length > 0) {
              pushLine(currentLineUnits, false);
            }
            currentLineUnits = [unit];
            currentLineWidth = unit.width;
          } else {
            // Unit exceeds line target width: split token across character boundaries
            for (const cm of unit.chars) {
              ctx.font = (cm.kind === 'super' || cm.kind === 'sub') ? superFont : baseFont;
              const charW = ctx.measureText(cm.displayChar).width;

              if (currentLineWidth + charW <= pLineTargetW || currentLineUnits.length === 0) {
                currentLineUnits.push({ chars: [cm], width: charW });
                currentLineWidth += charW;
              } else {
                pushLine(currentLineUnits, false);
                currentLineUnits = [{ chars: [cm], width: charW }];
                currentLineWidth = charW;
              }
            }
          }
        }
      }

      if (currentLineUnits.length > 0 || units.length === 0) {
        // isLastCanvasLineOfBlock = true; justification skipped only for the last PDF line
        pushLine(currentLineUnits, true);
      }

      // Account for the '\n' character itself between paragraph blocks
      globalCharOffset += pText.length;
      if (pIdx < rawLinesText.length - 1) {
        globalCharOffset += 1;
      }
    }

    return { lines, baseFont, superFont, ascenderPx, lineHeightPx };
  }, [text, initialRanges, r.w, r.h, scale, baseFontSizePx, currentFontFamily, isBold, isItalic, item, spans, blockAlign, getOrigLineBounds]);

  /**
   * Sequential X-Advance Tracking & Superscript Y-Elevation rendering per line
   */
  const drawCanvasLine = useCallback((ctx, line, layout, fontSizePx, defaultColor) => {
    let currentX = line.startX || 0;
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

      const curX = (line.charXPositions && line.charXPositions[i] != null) ? line.charXPositions[i] : currentX;
      ctx.fillText(cm.displayChar, curX, yPos);

      const charW = ctx.measureText(cm.displayChar).width;
      const extra = (line.extraPerSpace && (cm.origChar === ' ' || cm.origChar === '\u00A0')) ? line.extraPerSpace : 0;
      currentX = curX + charW + extra;
    }
  }, []);

  /**
   * Main Render Loop
   */
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const canvasW = Math.max(1, Math.round(r.w * dpr));
    const canvasH = Math.max(1, Math.round(r.h * dpr));
    canvas.width = canvasW;
    canvas.height = canvasH;
    canvas.style.width = `${r.w}px`;
    canvas.style.height = `${r.h}px`;

    ctx.scale(dpr, dpr);

    // 1. Solid White Background Fill
    ctx.clearRect(0, 0, r.w, r.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, r.w, r.h);

    // 2. Compute Layout
    const layout = computeLineLayout(ctx);

    // 3. Selection Highlight Rectangles (rgba(147, 197, 253, 0.6))
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

    // 4. Formatted Line Text & Dual-Baseline Superscripts
    for (const line of layout.lines) {
      drawCanvasLine(ctx, line, layout, baseFontSizePx, color);
    }

    // 5. 2px Smooth Blinking Caret Bar
    if (isFocused && selection.start === selection.end && caretVisible) {
      const targetOffset = selection.start;
      let caretLine = layout.lines[0];

      for (const line of layout.lines) {
        if (targetOffset >= line.charStartOffset && targetOffset <= line.charEndOffset) {
          caretLine = line;
          break;
        }
      }

      if (caretLine) {
        const localIdx = Math.max(0, Math.min(caretLine.text.length, targetOffset - caretLine.charStartOffset));
        const caretX = caretLine.charXPositions[localIdx] || 0;

        ctx.fillStyle = color || '#000000';
        ctx.fillRect(Math.floor(caretX), caretLine.yTop, 2, caretLine.lineHeightPx);
      }
    }

    // Store layout on canvas element for spatial hit testing
    canvas._layout = layout;
  }, [r.w, r.h, selection, isFocused, caretVisible, color, baseFontSizePx, computeLineLayout, drawCanvasLine]);

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

    // Line lookup
    const rawLineIdx = Math.floor(clickY / layout.lineHeightPx);
    const lineIdx = Math.max(0, Math.min(layout.lines.length - 1, rawLineIdx));
    const targetLine = layout.lines[lineIdx];

    // Horizontal char position lookup
    const charX = targetLine.charXPositions;
    const len = targetLine.text.length;

    if (clickX <= charX[0]) return targetLine.charStartOffset;
    if (clickX >= charX[len]) return targetLine.charEndOffset;

    for (let i = 0; i < len; i++) {
      const xLeft = charX[i];
      const xRight = charX[i + 1];
      const xMid = (xLeft + xRight) / 2;

      if (clickX < xMid) {
        return targetLine.charStartOffset + i;
      }
    }
    return targetLine.charEndOffset;
  }, [text.length]);

  /**
   * Mouse Pointer Event Handlers
   */
  const handlePointerDown = (e) => {
    e.preventDefault();
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
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(offset, offset);
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

  return (
    <>
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
        value={text}
        onChange={e => {
          setText(e.target.value);
          setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd });
          setCaretVisible(true);
        }}
        onSelect={e => {
          setSelection({ start: e.target.selectionStart, end: e.target.selectionEnd });
          setCaretVisible(true);
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={e => {
          // If blurring outside the editor container, commit edit
          const related = e.relatedTarget;
          const container = canvasRef.current?.parentElement;
          if (!container || !related || !container.contains(related)) {
            setIsFocused(false);
            handleCommit();
          }
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
    </>
  );
}
