import React, { useState, useEffect, useRef, useMemo } from 'react';
import { pdfToScreen } from '../../utils/pdfCoords';

const rgbToHex = (colorStr) => {
  if (!colorStr) return '#000000';
  if (colorStr.startsWith('#')) return colorStr;
  const match = colorStr.match(/\d+/g);
  if (!match || match.length < 3) return '#000000';
  return '#' + match.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
};

const FONTS = ['Original', 'Arial', 'Times New Roman', 'Courier', 'Verdana', 'Georgia'];

/**
 * Replace leading spaces with non-breaking spaces to prevent contenteditable
 * from stripping them on focus. This is the standard WYSIWYG workaround.
 */
const sanitizeForDisplay = (text) => {
  // Replace leading spaces with non-breaking spaces
  return text.replace(/^\s+/g, (match) => match.replace(/\s/g, '\u00A0'));
};

/**
 * Convert non-breaking spaces back to regular spaces before saving.
 * This ensures the backend receives standard space characters.
 */
const sanitizeForCommit = (text) => {
  return text.replace(/\u00A0/g, ' ');
};

/**
 * Build the initial DOM for the contentEditable span.
 * Splits `str` based on `superscriptRanges` — chars inside a range become
 * children of a <sup> or <sub> element, everything else is normal text.
 * Returns an array of React children.
 */
function buildInitialChildren(str, superscriptRanges, defaultColor) {
  // Replace leading spaces with non-breaking spaces to preserve indentation
  // when the contenteditable element receives focus
  const displayStr = sanitizeForDisplay(str);
  
  if (!superscriptRanges || superscriptRanges.length === 0) {
    return [displayStr];
  }
  // Sort ranges by charStart so we can walk left-to-right
  const sorted = [...superscriptRanges].sort((a, b) => a.charStart - b.charStart);
  const children = [];
  let cursor = 0;
  sorted.forEach((r, idx) => {
    if (r.charStart > cursor) {
      let beforeText = displayStr.slice(cursor, r.charStart);
      // Clean up excess spaces right before superscript (e.g. "Bost et al   " -> "Bost et al ")
      beforeText = beforeText.replace(/ {2,}$/, ' ');
      children.push(beforeText);
    }
    // Trim superscript chunk to eliminate space gaps inside <sup>
    const chunk = displayStr.slice(r.charStart, r.charEnd).trim();
    // Use authoritative backend-extracted span color r.color
    const supColor = r.color || defaultColor || 'inherit';
    if (r.kind === 'super') {
      children.push(
        <sup
          key={`sup-${idx}`}
          style={{
            fontSize: '0.65em',
            lineHeight: 0,
            margin: 0,
            padding: 0,
            color: supColor,
            verticalAlign: '0.4em',
            whiteSpace: 'nowrap',
          }}
        >
          {chunk}
        </sup>,
      );
    } else {
      children.push(
        <sub
          key={`sub-${idx}`}
          style={{
            fontSize: '0.65em',
            lineHeight: 0,
            margin: 0,
            padding: 0,
            color: supColor,
            verticalAlign: '-0.2em',
            whiteSpace: 'nowrap',
          }}
        >
          {chunk}
        </sub>,
      );
    }
    cursor = r.charEnd;
  });
  if (cursor < displayStr.length) {
    let afterText = displayStr.slice(cursor);
    // Clean up excess spaces right after superscript
    afterText = afterText.replace(/^ {2,}/, ' ');
    children.push(afterText);
  }
  return children;
}

/**
 * Walk the contentEditable DOM and extract plain text + the character
 * ranges that are inside <sup>/<sub> elements.
 * Returns { text, ranges: [{kind, charStart, charEnd}] }.
 */
function extractTextAndRanges(rootEl) {
  let text = '';
  const ranges = [];

  function walk(node, inSup, inSub) {
    if (node.nodeType === Node.TEXT_NODE) {
      const chunk = node.textContent || '';
      if (chunk.length === 0) return;
      const start = text.length;
      text += chunk;
      if (inSup) {
        ranges.push({ kind: 'super', charStart: start, charEnd: text.length });
      } else if (inSub) {
        ranges.push({ kind: 'sub', charStart: start, charEnd: text.length });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName ? node.tagName.toLowerCase() : '';
    const newInSup = inSup || tag === 'sup';
    const newInSub = inSub || tag === 'sub';
    for (const child of node.childNodes) {
      walk(child, newInSup, newInSub);
    }
  }

  walk(rootEl, false, false);

  // Merge adjacent same-kind ranges
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && last.kind === r.kind && last.charEnd === r.charStart) {
      last.charEnd = r.charEnd;
    } else {
      merged.push({ ...r });
    }
  }
  return { text, ranges: merged };
}

/**
 * Enrich newly-extracted ranges with metadata (font size, baseline Y) from
 * the original ranges. We match by ORDER and KIND — if the Nth super in
 * the new text corresponds to the Nth super in the original text, copy
 * its fontSize/pdfY_top so the backend can render it at the same scale
 * and elevation as the original.
 *
 * Brand-new ranges (no corresponding original) get null metadata, and
 * the backend falls back to defaults.
 */
function enrichRangesWithOriginalMetadata(newRanges, originalRanges) {
  if (!originalRanges || originalRanges.length === 0) return newRanges;
  // Index originals by kind, in order of appearance
  const origByKind = { super: [], sub: [] };
  for (const o of originalRanges) {
    if (o.kind === 'super' || o.kind === 'sub') {
      origByKind[o.kind].push(o);
    }
  }
  const usedByKind = { super: 0, sub: 0 };
  return newRanges.map((nr) => {
    const pool = origByKind[nr.kind];
    if (!pool || usedByKind[nr.kind] >= pool.length) {
      return { ...nr };
    }
    const orig = pool[usedByKind[nr.kind]];
    usedByKind[nr.kind] += 1;
    return {
      ...nr,
      // Carry forward original super/sub geometry. Backend uses these
      // to render the new chars at the same size and baseline elevation
      // as the original PDF's super/sub.
      fontSize: orig.fontSize,
      pdfY_top: orig.pdfY_top,
      pdfX: orig.pdfX,
      pdfH: orig.pdfH,
      color: orig.color,
    };
  });
}

/**
 * Hydrates paragraph text using PyMuPDF line structures to ensure 1:1 line matching
 * across ALL document paragraphs without manual CSS padding tweaks.
 * 
 * @param {Array<string>} pdfLines - Array of lines extracted from PyMuPDF block
 * @returns {string} - Formatted text safe for contenteditable rendering
 */
export function formatParagraphFromPdfLines(pdfLines) {
  if (!pdfLines || pdfLines.length === 0) return '';
  if (pdfLines.length === 1) return pdfLines[0];

  // Join lines while binding the line-break boundary word pairs with &nbsp; (\u00A0)
  return pdfLines.reduce((acc, currentLine, idx) => {
    if (idx === 0) return currentLine.trim();

    const lastSpaceIdx = acc.lastIndexOf(' ');
    if (lastSpaceIdx === -1) return `${acc}\u00A0${currentLine.trim()}`;

    const beforeWord = acc.substring(0, lastSpaceIdx);
    const lastWord = acc.substring(lastSpaceIdx + 1);
    
    return `${beforeWord} ${lastWord}\u00A0${currentLine.trim()}`;
  }, '');
}

export function InlineEditor({ item, scale, existingEdit, onCommit, onCancel }) {
  const initialStr = existingEdit ? existingEdit.newStr : item.str;
  const initialRanges = existingEdit
    ? existingEdit.superscriptRanges || []
    : item.superscriptRanges || [];

  // Clean soft hyphens and line-break artifacts on load
  const sanitizedText = useMemo(() => {
    const pdfLines = item.pdfLines || item.lines;
    if (pdfLines && pdfLines.length > 1) {
      return formatParagraphFromPdfLines(pdfLines)
        .replace(/\u00AD/g, '')
        .replace(/(\b[a-z]+)-\s*\n\s*([a-z]+\b)/gi, '$1$2');
    }
    if (!item.str && !item.text && !initialStr) return '';
    const raw = initialStr || item.str || item.text || '';
    return raw
      .replace(/\u00AD/g, '') // Remove soft hyphens
      .replace(/(\b[a-z]+)-\s*\n\s*([a-z]+\b)/gi, '$1$2'); // Clean intra-word line-break hyphens
  }, [initialStr, item.str, item.text, item.pdfLines, item.lines]);

  // We no longer store text as state — the DOM IS the source of truth.
  // We only read it when the user commits.
  const [fontSizeAdj, setFontSizeAdj] = useState(existingEdit ? existingEdit.fontSizeAdj : 0);
  const [color, setColor] = useState(() => existingEdit && existingEdit.color ? existingEdit.color : rgbToHex(item.color));
  const [fontFamily, setFontFamily] = useState(existingEdit && existingEdit.customFontFamily ? existingEdit.customFontFamily : 'Original');
  // Read bold/italic from the backend's authoritative PyMuPDF font flags
  // (item.isBold / item.isItalic). These are derived from either the
  // font's PDF flag bits or the PostScript name containing "Bold" /
  // "Italic" / "Oblique" — more reliable than PDF.js's text-layer
  // CSS weight heuristics, which often misreport for subsetted fonts.
  //
  // Fall back to PDF.js heuristics only if the backend didn't provide
  // the flags (e.g. regrouped items that skipped the extract-spacing path).
  const [isBold, setIsBold] = useState(() => {
    if (existingEdit) return existingEdit.isBold;
    return item.isBold === true;
  });
  const [isItalic, setIsItalic] = useState(() => {
    if (existingEdit) return existingEdit.isItalic;
    return item.isItalic === true;
  });

  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const r = pdfToScreen(item, scale);
  const fsize = Math.max(8, Math.round(item.fontSize * scale) + fontSizeAdj);

  const spanRef = useRef(null);

  // ── Uncontrolled DOM init: inject initial content ONCE via innerHTML ────────
  // NEVER pass children to the contentEditable span in JSX — doing so causes
  // React to diff and mutate DOM text nodes on every render (e.g. toolbar
  // state changes), which invalidates the browser's Selection/Range and resets
  // the caret position after each spacebar press.
  //
  // Instead: build the HTML string once here, set innerHTML once on mount,
  // and let the browser's native contenteditable engine own the DOM from
  // that point forward. React only touches the style prop (safe — no caret
  // impact) and reads innerHTML on commit.
  useEffect(() => {
    if (!spanRef.current) return;

    // Build an HTML string equivalent of buildInitialChildren
    const displayStr = sanitizeForDisplay(sanitizedText);
    let html = '';

    const escapeHtml = (s) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const pdfLines = item.pdfLines || item.lines || (sanitizedText.includes('\n') ? sanitizedText.split('\n') : null);

    if (pdfLines && pdfLines.length > 1 && (!initialRanges || initialRanges.length === 0)) {
      const totalLines = pdfLines.length;
      html = pdfLines.map((lineText, index) => {
        const isLastLine = index === totalLines - 1;
        const lineClass = isLastLine ? 'pdf-line last-pdf-line' : 'pdf-line';
        const formattedText = escapeHtml(lineText).replace(/(\w+)\s*&lt;sup\b[^&]*&gt;(.*?)&lt;\/sup&gt;/g, 
          '<span style="white-space: nowrap;">$1<sup style="display: inline; line-height: 0; vertical-align: super;">$2</sup></span>'
        );
        if (isLastLine) {
          return `<span class="${lineClass}" style="text-align-last: left; display: inline-block; width: 100%;">${formattedText}</span>`;
        }
        return `<span class="${lineClass}">${formattedText}</span><br />`;
      }).join('');
    } else if (!initialRanges || initialRanges.length === 0) {
      html = escapeHtml(displayStr);
    } else {
      const sorted = [...initialRanges].sort((a, b) => a.charStart - b.charStart);
      let cursor = 0;
      for (let idx = 0; idx < sorted.length; idx++) {
        const rng = sorted[idx];
        if (rng.charStart > cursor) {
          let beforeText = displayStr.slice(cursor, rng.charStart);
          beforeText = beforeText.replace(/ {2,}$/, ' ');
          
          // Atomic citation unit: Wrap preceding word + superscript tag in a non-breaking span
          const lastSpaceIdx = beforeText.lastIndexOf(' ');
          if (lastSpaceIdx !== -1) {
            const prefix = beforeText.slice(0, lastSpaceIdx + 1);
            const lastWord = beforeText.slice(lastSpaceIdx + 1);
            html += escapeHtml(prefix);

            const chunk = displayStr.slice(rng.charStart, rng.charEnd).trim();
            const supColor = rng.color || color || 'inherit';
            const tag = rng.kind === 'super' ? 'sup' : 'sub';
            const vAlign = rng.kind === 'super' ? '0.4em' : '-0.2em';

            html += `<span style="white-space:nowrap">${escapeHtml(lastWord)}<${tag} style="font-size:0.65em;line-height:0;display:inline;margin:0;padding:0;color:${escapeHtml(supColor)};vertical-align:${vAlign}">${escapeHtml(chunk)}</${tag}></span>`;
          } else {
            const lastWord = beforeText;
            const chunk = displayStr.slice(rng.charStart, rng.charEnd).trim();
            const supColor = rng.color || color || 'inherit';
            const tag = rng.kind === 'super' ? 'sup' : 'sub';
            const vAlign = rng.kind === 'super' ? '0.4em' : '-0.2em';

            html += `<span style="white-space:nowrap">${escapeHtml(lastWord)}<${tag} style="font-size:0.65em;line-height:0;display:inline;margin:0;padding:0;color:${escapeHtml(supColor)};vertical-align:${vAlign}">${escapeHtml(chunk)}</${tag}></span>`;
          }
        } else {
          const chunk = displayStr.slice(rng.charStart, rng.charEnd).trim();
          const supColor = rng.color || color || 'inherit';
          const tag = rng.kind === 'super' ? 'sup' : 'sub';
          const vAlign = rng.kind === 'super' ? '0.4em' : '-0.2em';
          html += `<${tag} style="font-size:0.65em;line-height:0;display:inline;margin:0;padding:0;color:${escapeHtml(supColor)};vertical-align:${vAlign};white-space:nowrap">${escapeHtml(chunk)}</${tag}>`;
        }
        cursor = rng.charEnd;
      }
      if (cursor < displayStr.length) {
        let afterText = displayStr.slice(cursor);
        afterText = afterText.replace(/^ {2,}/, ' ');
        html += escapeHtml(afterText);
      }
    }

    spanRef.current.innerHTML = html;

    // Place cursor at end after content is injected
    try {
      spanRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(spanRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps: run ONCE on mount only — never re-inject while typing


  // Handle mobile keyboard
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

  const handleCommit = () => {
    let newText = initialStr;
    let newRanges = initialRanges;
    if (spanRef.current) {
      const extracted = extractTextAndRanges(spanRef.current);
      newText = extracted.text;
      // Carry original super/sub metadata (fontSize, baseline Y) into the
      // new ranges so the backend can render them at the correct size
      // and elevation rather than estimating from parent line metrics.
      newRanges = enrichRangesWithOriginalMetadata(
        extracted.ranges,
        initialRanges,
      );
    }
    // Convert non-breaking spaces back to regular spaces before committing
    // so the backend receives standard space characters
    const cleanText = sanitizeForCommit(newText);
    onCommit(
      cleanText,
      { fontSizeAdj, color, fontFamily, isBold, isItalic },
      newRanges,
    );
  };

  // Build font stack using the real embedded font (from /extract-fonts + @font-face).
  // Try multiple name forms because different PDFs store names differently:
  //   "NBUDXT+MetaProLight-Regular" (full with subset tag) 
  //   "MetaProLight-Regular"        (stripped)
  //   whatever the backend calls item.fontPostScriptName
  const stripSubset = (name) => (name || '').replace(/^[A-Z]{6}\+/, '');
  const sanitizeFontName = (name) => (name || '').replace(/\s*-\s*/g, '-');
  const fontCandidates = [
    item.fontPostScriptName,
    stripSubset(item.fontPostScriptName),
    item.fontName,
    stripSubset(item.fontName),
  ].filter(Boolean);
  // Dedupe while preserving order
  const uniqueCandidates = [...new Set(fontCandidates)];
  // Ensure exact PostScript name matching for the FontFace API by removing spaces around dashes
  const sanitizedCandidates = uniqueCandidates.map(sanitizeFontName);
  const realFontStack = sanitizedCandidates.map(n => `"${n}"`).join(', ');

  const currentFontFamily = fontFamily === 'Original' 
    ? (item.renderedFontFamily || `${realFontStack}, "Times New Roman", Georgia, serif`) 
    : fontFamily;

  // Check if the browser has actually loaded the embedded font from the PDF.
  // Used to drive the ✓ Embedded / ⚠ Fallback badge in the toolbar.
  const isFontEmbeddedAndActive = useMemo(() => {
    if (fontFamily !== 'Original') return false;
    try {
      return sanitizedCandidates.some(name =>
        document.fonts.check(`12px "${name}"`)
      );
    } catch {
      return false;
    }
  }, [fontFamily, sanitizedCandidates]);

  // ── Horizontal spacing correction ─────────────────────────────────────────
  // Paragraphs: use CSS letter-spacing to distribute any width deficit/surplus
  // evenly across characters — this preserves glyph shapes and works in concert
  // with text-align:justify (which already handles word-spacing via Tw).
  //
  // Single-line items: keep scaleX geometric compression since justify has no
  // effect on a single unwrapped line and letter-spacing alone can't fill the gap.
  const [scaleX, setScaleX] = useState(1);
  const [letterSpacingEm, setLetterSpacingEm] = useState(0); // em units, scale-invariant for paragraphs

  useEffect(() => {
    if (!item.isParagraph || !spanRef.current || !r.w || !r.h) return;

    let isCancelled = false;

    const measure = () => {
      if (isCancelled || !spanRef.current) return;

      // 1. Create a hidden offscreen clone to safely measure unwrapped text width
      // This prevents layout thrashing and avoids destroying the active contenteditable caret/selection
      const clone = spanRef.current.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.pointerEvents = 'none';
      clone.style.whiteSpace = 'nowrap';
      clone.style.width = 'auto';
      clone.style.maxWidth = 'none';
      document.body.appendChild(clone);

      // 2. Measure true unwrapped width of all characters + inline superscripts combined
      const singleLineWidth = clone.scrollWidth;
      document.body.removeChild(clone);

      // 3. Compute target total width based on PyMuPDF box height vs rendered line height
      const currentFontSizePx = Math.max(1, (item.fontSize || 10) * scale + (fontSizeAdj || 0));
      const estimatedLineHeight = item.lineHeight ? item.lineHeight * scale : currentFontSizePx * 1.2;
      const targetLineCount = Math.max(1, Math.round(r.h / estimatedLineHeight));
      const targetTotalWidth = r.w * targetLineCount;

      // 4. Calculate kerning delta per non-whitespace character
      const deficit = targetTotalWidth - singleLineWidth;
      const rawText = spanRef.current.innerText || sanitizedText || '';
      const nonWhitespaceChars = Math.max(1, rawText.replace(/\s/g, '').length);

      const rawPxPerChar = deficit / nonWhitespaceChars;
      const rawEm = rawPxPerChar / currentFontSizePx;

      // Standard dynamic measurement clamping
      const clampedEm = Math.max(-0.035, Math.min(0.035, rawEm));

      setLetterSpacingEm(clampedEm);
      setScaleX(1);
    };

    // Wait for document fonts to finish loading so scrollWidth measurements are accurate
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!isCancelled) requestAnimationFrame(measure);
      });
    } else {
      requestAnimationFrame(measure);
    }

    return () => {
      isCancelled = true;
    };
  }, [sanitizedText, item.isParagraph, item.fontSize, item.lineHeight, r.w, r.h, scale, fontSizeAdj, fontFamily]);

  // ─── Fix 4: Baseline vs Bounding Box Alignment ───────────────────────────
  // PDF draws text from its BASELINE (pdfY_base). HTML positions from the TOP
  // of the box (r.y = pdfY_top × scale). Inside the CSS box the browser places
  // the first-line baseline at:  paddingTop + halfLeading + actualBoundingBoxAscent.
  // We must solve for paddingTop so that the HTML baseline = PDF baseline.
  const fontSizePx = (item.fontSize * scale) + fontSizeAdj;
  const lineHeightPx = (item.isParagraph && item.lineHeight)
    ? item.lineHeight * scale
    : r.h;

  // Measure where the browser actually puts the ascender for this font+size.
  // We use the Canvas 2D API — it honours @font-face registrations.
  // Ensure exact PostScript name matching by removing spaces around dashes.
  const sanitizedFontName = (name) => (name || '').replace(/\s*-\s*/g, '-');
  const canvasFontFamily = fontFamily === 'Original'
    ? `${fontSizePx}px ${sanitizedFontName(item.fontPostScriptName || item.fontName)}, serif`
    : `${fontSizePx}px ${currentFontFamily}`;
  
  const htmlAscenderPx = useMemo(() => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = canvasFontFamily;
      const m = ctx.measureText('Hpx');
      // Prioritize fontBoundingBoxAscent (EM-box metric) over actualBoundingBoxAscent (ink height)
      const asc = (m.fontBoundingBoxAscent != null && !isNaN(m.fontBoundingBoxAscent))
        ? m.fontBoundingBoxAscent
        : m.actualBoundingBoxAscent;
      return asc;
    } catch (e) {
      // Fallback: assume 80% of font-size is above the baseline
      return fontSizePx * 0.8;
    }
  }, [fontSizePx, canvasFontFamily]);

  // PDF ascender: distance from bounding box top to baseline (PDF units → px)
  const pdfAscenderPx = item.pdfY_base != null && item.pdfY_top != null
    ? (item.pdfY_base - item.pdfY_top) * scale
    : htmlAscenderPx; // graceful fallback: no shift

  // CSS distributes (lineHeight - fontSize) evenly above and below each line
  const halfLeading = Math.max(0, (lineHeightPx - fontSizePx) / 2);

  // Solve: pdfAscenderPx = paddingTop + halfLeading + htmlAscenderPx
  const baselineOffset = pdfAscenderPx - halfLeading - htmlAscenderPx;

  // If offset > 0: add paddingTop to push text down to the PDF baseline.
  // If offset < 0: pull the whole box up (can't use negative padding).
  const baselinePaddingTop = baselineOffset >= 0 ? baselineOffset : 0;
  const baselineTopAdj     = baselineOffset <  0 ? baselineOffset : 0; // negative px
  // Calculate exact line height to fit target lines within PyMuPDF bounding box (r.h)
  const baseFontSizePx = (item.fontSize || 10) * scale + (fontSizeAdj || 0);
  const estimatedLineHeight = item.lineHeight ? item.lineHeight * scale : baseFontSizePx * 1.2;
  const targetLineCount = Math.max(1, Math.round(r.h / estimatedLineHeight));
  const exactLineHeightPx = (item.isParagraph && r.h > 0) ? (r.h / targetLineCount) : estimatedLineHeight;
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: r.x,
          top: Math.max(0, r.y - 70 - keyboardOffset),
          zIndex: 102,
          width: 'max-content'
        }}
        className="flex flex-col bg-white border border-gray-300 rounded-md shadow-lg pointer-events-auto divide-y divide-gray-200"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
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
          />

          <div className="w-px h-4 bg-gray-300 mx-1"></div>

          <button onClick={() => setIsBold(!isBold)} className={`w-6 h-6 flex items-center justify-center text-sm font-bold rounded ${isBold ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`} title="Bold">B</button>
          <button onClick={() => setIsItalic(!isItalic)} className={`w-6 h-6 flex items-center justify-center text-sm italic rounded ${isItalic ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`} title="Italic">I</button>

          <div className="w-px h-4 bg-gray-300 mx-1"></div>

          <button onClick={() => setFontSizeAdj(v => v - 1)} className="px-1.5 py-1 text-xs font-semibold hover:bg-gray-100 rounded" title="Smaller">A-</button>
          <button onClick={() => setFontSizeAdj(v => v + 1)} className="px-1.5 py-1 text-xs font-semibold hover:bg-gray-100 rounded" title="Larger">A+</button>

          <div className="w-px h-4 bg-gray-300 mx-1"></div>

          <button onClick={handleCommit} className="px-2 py-1 text-xs text-blue-600 font-medium hover:bg-blue-50 rounded">Done</button>
          <button onClick={onCancel} className="px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 rounded">✕</button>
        </div>
      </div>

      {/* Solid white background rectangle to cover underlying PDF canvas text */}
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

      <span
        ref={spanRef}
        contentEditable
        suppressContentEditableWarning
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Escape') onCancel();
          if (!item.isParagraph && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommit();
          }
        }}
        onPaste={e => {
          e.preventDefault();
          const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
          if (text) {
            document.execCommand('insertText', false, text);
          }
        }}
        onKeyUp={e => e.stopPropagation()}
        onKeyPress={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        className="rounded-[3px]"
        style={{
          position: 'absolute',
          top: r.y + baselineTopAdj,
          left: r.x,
          paddingTop: `${baselinePaddingTop}px`,
          paddingBottom: '0px',
          paddingLeft: item.isParagraph ? '0px' : '2px',
          paddingRight: item.isParagraph ? '0px' : '2px',
          // scaleX only applies to single-line items (paragraphs use letterSpacing instead)
          transform: `scaleX(${scaleX}) ${keyboardOffset ? `translateY(${-keyboardOffset}px)` : ''}`,
          transformOrigin: '0% 0%',
          fontFamily: currentFontFamily,
          fontSize: `${baseFontSizePx}px`,
          fontWeight: isBold ? 'bold' : 'normal',
          fontStyle: isItalic ? 'italic' : 'normal',
          color: color,
          // Always use 'pre-wrap' to preserve all whitespace including leading indents
          // and paragraph structure without stripping spaces.
          whiteSpace: 'pre-wrap',
          textIndent: (item.isParagraph && item.textIndent) ? `${item.textIndent * scale}px` : undefined,
          wordBreak: item.isParagraph ? 'break-word' : 'normal',
          width: `${r.w}px`,
          minWidth: `${r.w}px`,
          maxWidth: `${r.w}px`,
          height: item.isParagraph ? `${r.h}px` : `${r.h}px`,
          maxHeight: item.isParagraph ? `${r.h}px` : undefined,
          minHeight: `${r.h}px`,
          boxSizing: 'border-box',
          display: 'block',
          cursor: 'text',
          zIndex: 100,
          lineHeight: `${exactLineHeightPx}px`,
          textAlign: item.align || (item.isParagraph ? 'justify' : 'left'),
          textAlignLast: item.isParagraph ? 'left' : undefined, // Fixes last-line blowout and right-pushed superscripts
          WebkitTextAlignLast: item.isParagraph ? 'left' : undefined,
          // inter-word: browser expands word gaps to fill width (mirrors PDF Tw operator)
          textJustify: item.isParagraph ? 'inter-word' : undefined,
          // Explicitly disable browser dictionary auto-hyphenation
          hyphens: 'none',
          WebkitHyphens: 'none',
          msHyphens: 'none',
          // Micro-spacing adjustments
          letterSpacing: item.isParagraph && letterSpacingEm !== 0 ? `${letterSpacingEm.toFixed(4)}em` : undefined,
          wordSpacing: item.isParagraph && letterSpacingEm > 0 ? `${(letterSpacingEm * 1.5).toFixed(4)}em` : undefined,
          margin: 0,
          outline: 'none',
          overflow: item.isParagraph ? 'hidden' : 'visible',
          border: '1px dashed rgba(148, 163, 184, 0.8)',
          backgroundColor: '#ffffff',
        }}
      >
        {/* No JSX children — content is injected once via innerHTML in useEffect.
            React must never touch this span's DOM children after mount or it
            will invalidate the browser Selection and reset the caret. */}
      </span>
    </>
  );
}
