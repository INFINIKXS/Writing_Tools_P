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

const SUPERSAMPLE_FACTOR = 1; // 1:1 physical mapping; LCD sub-pixel AA provides all needed crispness
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

const nativeStemWidthCache = new Map();

if (typeof window !== 'undefined') {
  const clearCache = () => nativeStemWidthCache.clear();
  window.addEventListener('resize', clearCache);
  if (document.fonts) {
    document.fonts.ready.then(clearCache);
  }
}

/**
 * Measures the font face's authentic native vertical stem ratio using
 * FreeType's vertical stem benchmark suite (['l', 'I', 'H', 'n']).
 */
function measureNativeStemWidthPx(fontString, dpr = 1) {
  const cacheKey = `${fontString}__dpr${dpr.toFixed(2)}`;
  if (nativeStemWidthCache.has(cacheKey)) return nativeStemWidthCache.get(cacheKey);

  // Single-character probe: 'l' is a clean, unadorned, full-ascender-height
  // vertical stroke with no crossbar (H), no x-height/row-mismatch risk (n, i),
  // and no curved/tapering base (t). Every other character tried introduced a
  // distinct measurement bug of its own; 'l' alone has given a consistent,
  // plausible reading across every test in this investigation.
  const stemChars = ['l'];
  const probeSize = 256; // large + fixed, so measurement precision doesn't depend on the real render size
  const probe = document.createElement('canvas');
  probe.width = probeSize;
  probe.height = probeSize;
  const pctx = probe.getContext('2d');

  const probeFont = fontString.replace(/[\d.]+px/, `${probeSize * 0.5}px`);
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  pctx.font = probeFont;
  pctx.fillStyle = '#000';
  pctx.textBaseline = 'alphabetic';

  const measurements = []; // {ch, ratio} pairs, kept together through sorting
  const midY = Math.round(probeSize * 0.5);

  for (const ch of stemChars) {
    pctx.clearRect(0, 0, probeSize, probeSize);
    pctx.fillText(ch, 10, probeSize * 0.75);

    const row = pctx.getImageData(0, midY, probeSize, 1).data;

    let start = -1, end = -1;
    for (let x = 0; x < probeSize; x++) {
      if (row[x * 4 + 3] > 127) { // 50% coverage — standard anti-aliased edge boundary, not a tuning knob
        if (start === -1) start = x;
        end = x;
      }
    }
    if (start >= 0) {
      measurements.push({ ch, ratio: (end - start + 1) / (probeSize * 0.5) });
    }
  }

  if (measurements.length === 0) return 0;

  measurements.sort((a, b) => a.ratio - b.ratio);
  const medianEntry = measurements[Math.floor(measurements.length / 2)];
  const medianRatio = medianEntry.ratio;

  // ONLY cache if font is confirmed loaded in browser memory,
  // preventing premature fallback measurements from permanently corrupting the cache.
  const isFontLoaded = typeof document !== 'undefined' && document.fonts && document.fonts.check(probeFont);
  if (isFontLoaded) {
    nativeStemWidthCache.set(cacheKey, medianRatio);
  }

  return medianRatio;
}

// Replaces getStemDarkeningPx entirely:
const getStemDarkeningPx = (fontString, fontSizePx, stemVwRatio, dpr = 1) => {
  // TrueType / Base-14 fonts (stemVwRatio is null) use native browser bytecode grid-fitting;
  // do not add synthetic stem darkening offset.
  if (stemVwRatio == null) return 0;

  const targetStemWidthPx = stemVwRatio * fontSizePx;
  const nativeStemRatio = measureNativeStemWidthPx(fontString, dpr);
  const nativeStemWidthPx = nativeStemRatio * fontSizePx;
  const result = Math.max(0, targetStemWidthPx - nativeStemWidthPx);

  const logKey = `${fontString}__${fontSizePx.toFixed(1)}`;
  if (!getStemDarkeningPx._loggedKeys) getStemDarkeningPx._loggedKeys = new Set();
  if (!getStemDarkeningPx._loggedKeys.has(logKey)) {
    getStemDarkeningPx._loggedKeys.add(logKey);
  }

  return result;
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
  return text.replace(/\u00A0/g, ' ').replace(/\u00AD/g, '');
};

/**
 * Strip 6-letter subset tag prefix (e.g. "NBUDXT+MetaProLight-Regular" -> "MetaProLight-Regular")
 */
const stripSubset = (name) => (name || '').replace(/^[A-Z]{6}\+/, '');
const sanitizeFontName = (name) =>
  (name || '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+(Regular|Reg|Bold|Italic|Oblique)$/i, '');

const LIGATURE_MAP = {
  '\uFB00': ['f', 'f'],
  '\uFB01': ['f', 'i'],
  '\uFB02': ['f', 'l'],
  '\uFB03': ['f', 'f', 'i'],
  '\uFB04': ['f', 'f', 'l'],
  '\uFB05': ['f', 't'],
  '\uFB06': ['s', 't'],
};

// Ligature expansion: split multi-codepoint or single-codepoint ligature char entries
// into per-codepoint entries with interpolated geometry so all mappers keep 1:1 correspondence.
const expandMultiCharEntries = (chars) => {
  const out = [];
  for (const meta of chars) {
    const c = meta?.c ?? meta?.char ?? '';
    if (c === '\u00AD') continue;
    const ligSplit = LIGATURE_MAP[c];
    if (ligSplit) {
      const x0 = Number.isFinite(meta.x0) ? meta.x0 : meta.origin_x;
      const x1 = Number.isFinite(meta.x1) ? meta.x1 : meta.origin_x;
      for (let k = 0; k < ligSplit.length; k++) {
        const sx0 = x0 + ((x1 - x0) * k) / ligSplit.length;
        const sx1 = x0 + ((x1 - x0) * (k + 1)) / ligSplit.length;
        out.push({
          ...meta,
          c: ligSplit[k],
          char: ligSplit[k],
          text: ligSplit[k],
          x0: sx0,
          x1: sx1,
          origin_x: k === 0 ? meta.origin_x : sx0,
        });
      }
    } else if (c.length > 1 && !/\s/.test(c) && Number.isFinite(meta.origin_x)) {
      const x0 = Number.isFinite(meta.x0) ? meta.x0 : meta.origin_x;
      const x1 = Number.isFinite(meta.x1) ? meta.x1 : meta.origin_x;
      for (let k = 0; k < c.length; k++) {
        const sx0 = x0 + ((x1 - x0) * k) / c.length;
        const sx1 = x0 + ((x1 - x0) * (k + 1)) / c.length;
        out.push({
          ...meta,
          c: c[k],
          char: c[k],
          text: c[k],
          x0: sx0,
          x1: sx1,
          origin_x: k === 0 ? meta.origin_x : sx0,
        });
      }
    } else {
      out.push(meta);
    }
  }
  return out;
};

/**
 * Sanity-check a backend PDF character's coordinate metadata.
 * MuPDF can synthesise degenerate bboxes (NaN, zero-width, wildly out-of-page)
 * for condensed CFF fonts and symbol glyphs in PyMuPDF ≥1.25.0.  Any char
 * failing this gate falls back to pure canvas flow placement so fillText(x=NaN)
 * never silently swallows lines.
 */
const isSaneChar = (c, pageW = 2000) =>
  c != null &&
  Number.isFinite(c.x0) && Number.isFinite(c.x1) &&
  (c.x1 - c.x0) > 0.05 &&
  c.x0 >= -50 && c.x1 <= pageW + 50;

/**
 * Extract character metadata (normal, super, sub) for a text string,
 * taking into account superscriptRanges, HTML <sup>/<sub> tags, or Unicode superscripts.
 */
function parseCharMetadata(rawText, initialRanges = [], origLines = null) {
  if (!rawText) return { cleanText: '', charMeta: [] };
  rawText = rawText.replace(/\u00AD/g, '');

  const backendChars = (origLines && Array.isArray(origLines))
    ? expandMultiCharEntries(origLines.flatMap(l => l.chars || []))
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
        const charFont = bMeta.font || null;
        const charIsItalic = charFont ? /italic|oblique|-it$|-it\b/i.test(charFont) : null;
        const charIsBold = charFont ? /bold|black|heavy|semibold|-bd/i.test(charFont) : null;
        // Only propagate PDF coordinate metadata if the char passed a sanity
        // check.  Degenerate bboxes (NaN, zero-width, out-of-range) from the
        // PyMuPDF >=1.25 CFF metric regression would produce NaN deltas and
        // invisible text in the canvas engine.
        const charPassesSanity = isSaneChar(bMeta);

        cleanChars.push(origChar);
        charMeta.push({
          origChar,
          displayChar,
          kind,
          color,
          charIndex: i,
          charFont,
          charIsItalic,
          charIsBold,
          pdfSize: bMeta.size || undefined,
          pdfOriginX: (charPassesSanity && bMeta.origin_x != null) ? bMeta.origin_x : undefined,
          pdfOriginY: (charPassesSanity && bMeta.origin_y != null) ? bMeta.origin_y : undefined,
          // Expose raw bbox for the isSaneChar gate in pushLine
          pdfX0: charPassesSanity ? bMeta.x0 : undefined,
          pdfX1: charPassesSanity ? bMeta.x1 : undefined,
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
          color: meta.color,
          // Carry the PDF-measured font size for this run so the backend
          // paragraph bake can emit the correct superscript size.
          fontSize: meta.pdfSize || null,
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
  if (typeof item?.flags === 'number' && (item.flags & 16)) return true;
  return false;
};

const detectItalic = (item) => {
  if (item?.isItalic === true) return true;
  const name = (item?.fontPostScriptName || item?.fontName || '').toLowerCase();
  if (/italic|oblique/.test(name)) return true;
  if (typeof item?.flags === 'number' && (item.flags & 2)) return true;
  return false;
};

// Robust line-to-string sanitizer — handles every shape the backend can emit:
// plain string, { text }, { str }, { chars: [...] }, or a bare char array.
const lineToStr = (l) => {
  if (typeof l === 'string') return l;
  if (l == null) return '';
  if (typeof l.text === 'string') return l.text;
  if (typeof l.str === 'string') return l.str;
  if (Array.isArray(l.chars))
    return l.chars.map(c => (typeof c === 'string' ? c : (c?.c ?? ''))).join('');
  if (Array.isArray(l))
    return l.map(x => (typeof x === 'string' ? x : (x?.c ?? x?.str ?? x?.text ?? ''))).join('');
  return '';
};

const extractColor = (item) => {
  if (item?.color) return rgbToHex(item.color);
  const firstChar = item?.origLines?.[0]?.chars?.[0] || item?.lines?.[0]?.chars?.[0];
  if (firstChar?.color) return rgbToHex(firstChar.color);
  return '#000000';
};

export function CanvasInlineEditor({ item, scale, existingEdit, onCommit, onCancel, onHeightChange }) {
  const getInitialText = useCallback(() => {
    let raw = '';
    if (existingEdit && existingEdit.newStr) raw = existingEdit.newStr;
    else if (item.lines && item.lines.length > 0) {
      raw = item.lines.map(lineToStr).join('\n');
    } else if (item.rawPdfLines && item.rawPdfLines.length > 0) raw = item.rawPdfLines.join('\n');
    else raw = item.str || item.text || '';
    return raw.replace(/\u00AD/g, '');
  }, [existingEdit, item]);

  const rawInitialStr = getInitialText();
  const origLines = item?.origLines || (Array.isArray(item?.lines) && item.lines[0]?.chars ? item.lines : null) || item?.blockData?.origLines;

  // Safety-net: backend bboxes can exclude bullet/dingbat spans (Symbol font)
  // and even their lines. Expand to the union of every char bbox and every
  // inline image bbox so nothing renders at negative canvas coordinates.
  item = useMemo(() => {
    let minX = Number.isFinite(item.pdfX) ? item.pdfX : 0;
    let minY = Number.isFinite(item.pdfY_top) ? item.pdfY_top : 0;
    let maxX = minX + (item.pdfW || 0);
    let maxY = minY + (item.pdfH || 0);
    for (const l of origLines || []) {
      for (const c of l?.chars || []) {
        if (Number.isFinite(c.x0)) minX = Math.min(minX, c.x0);
        if (Number.isFinite(c.x1)) maxX = Math.max(maxX, c.x1);
        if (Number.isFinite(c.y0)) minY = Math.min(minY, c.y0);
        if (Number.isFinite(c.y1)) maxY = Math.max(maxY, c.y1);
      }
    }
    for (const im of item.inlineImages || []) {
      if (Array.isArray(im.bbox)) {
        minX = Math.min(minX, im.bbox[0]);
        minY = Math.min(minY, im.bbox[1]);
        maxX = Math.max(maxX, im.bbox[2]);
        maxY = Math.max(maxY, im.bbox[3]);
      }
    }
    return { ...item, pdfX: minX, pdfY_top: minY, pdfW: maxX - minX, pdfH: maxY - minY };
  }, [item, origLines]);

  const initialParsed = useMemo(() => {
    const rawInitialRanges = existingEdit ? existingEdit.superscriptRanges || [] : item.superscriptRanges || [];
    return parseCharMetadata(rawInitialStr, rawInitialRanges, origLines);
  }, [rawInitialStr, existingEdit, item, origLines]);
  const initialStr = initialParsed.cleanText;
  const initialRanges = useMemo(() => extractRangesFromCharMeta(initialParsed.charMeta), [initialParsed.charMeta]);
  const initialLinesText = useMemo(() => initialStr.split('\n'), [initialStr]);

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
  // ── Single-source-of-truth char attribute model ──────────────────────────
  // Seeded once at mount from parseCharMetadata; thereafter spliced on each
  // keystroke in the onChange handler. NEVER re-parsed after mount.
  const charMetaRef = useRef(initialParsed.charMeta);

  const canvasRef = useRef(null);
  const textareaRef = useRef(null);
  const editorContainerRef = useRef(null); // wraps all editor DOM elements
  const handleCommitRef = useRef(null);    // stable ref to latest handleCommit
  const isDraggingRef = useRef(false);
  const dragAnchorRef = useRef(0);
  const isProgrammaticSelectionRef = useRef(false);
  const lastReportedDeltaHRef = useRef(null);
  // Cache for decoded inline image elements (keyed by base64 data string)
  const imgCache = useRef({});

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
  const nativeDpr = window.devicePixelRatio || 1;
  const dpr = Math.min(nativeDpr * SUPERSAMPLE_FACTOR, MAX_EFFECTIVE_DPR);
  
  // Calculate exact 1:1 CSS dimensions to prevent compositor scaling blur
  const canvasW = Math.max(1, Math.round(r.w * dpr));
  const cssW = canvasW / dpr;
  
  const canvasH_initial = Math.max(1, Math.round(r.h * dpr));
  const cssH_initial = canvasH_initial / dpr;

  const baseFontSizePx = Math.max(8, (item.fontSize * scale) + fontSizeAdj);
  // Authoritative block alignment from PyMuPDF or paragraphTypography
  const blockAlign = paragraphTypography.align || item.align || 'left';

  const firstCharFont = origLines?.[0]?.chars?.[0]?.font || item?.lines?.[0]?.chars?.[0]?.font;

  // Build Comprehensive Font Stack
  const fontCandidates = [
    item.fontPostScriptName,
    stripSubset(item.fontPostScriptName),
    sanitizeFontName(stripSubset(item.fontPostScriptName)),
    item.fontName,
    stripSubset(item.fontName),
    sanitizeFontName(stripSubset(item.fontName)),
    item.font,
    stripSubset(item.font),
    sanitizeFontName(stripSubset(item.font)),
    firstCharFont,
    stripSubset(firstCharFont),
    sanitizeFontName(stripSubset(firstCharFont)),
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
      // Prefer the explicit line_bbox that the backend now injects (includes
      // attached bullet markers). Fall back to line_x0 / pdfX / bbox[0].
      const lb = origLine.line_bbox;
      const lbX0 = Array.isArray(lb) && Number.isFinite(lb[0]) ? lb[0] : null;
      x0 = lbX0 ?? origLine.line_x0 ?? origLine.pdfX ?? (Array.isArray(origLine.bbox) ? origLine.bbox[0] : null);
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
    // Also consider line_bbox right edge (backend now includes bullet marker extents)
    if (origLine && Array.isArray(origLine.line_bbox) && Number.isFinite(origLine.line_bbox[2])) {
      containerRightX = Math.max(containerRightX, origLine.line_bbox[2]);
    }

    return { line_x0: x0, line_x1: containerRightX };
  }, [item.pdfX, item.pdfW, item.bbox, item.blockData, item.textIndent, r.w, scale]);

  /**
   * Layout Engine: Breaks text into lines, applies Atomic Citation Unit binding,
   * measures character X offsets, and calculates dual-baseline vertical positions.
   */
  const computeLineLayout = useCallback((ctx) => {
    // Use the authoritative charMeta ref — never re-parse from text after mount.
    const charMeta = charMetaRef.current;
    
    const baseFontSizePt = item.fontSize + (fontSizeAdj / scale);
    // Font specs
    const baseFont = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${baseFontSizePt}px ${currentFontFamily}`;
    // Preserve exact proportional metrics to prevent ascent/descent baseline drops
    const superFont = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${baseFontSizePt * 0.65}px ${currentFontFamily}`;

    // Measure HTML ascender
    ctx.font = baseFont;
    let ascenderPx = baseFontSizePt * 0.8;
    try {
      const m = ctx.measureText('Hpx');
      if (m.actualBoundingBoxAscent != null && !isNaN(m.actualBoundingBoxAscent)) {
        ascenderPx = m.actualBoundingBoxAscent;
      } else if (m.fontBoundingBoxAscent != null && !isNaN(m.fontBoundingBoxAscent)) {
        ascenderPx = m.fontBoundingBoxAscent;
      }
    } catch {
      // Fall back to default ascender estimate if font metrics unavailable
    }

    // Real, PDF-measured offset from top of block to line 1's baseline
    const firstLineBaselineOffsetPt = (item.pdfY_base != null && item.pdfY_top != null)
      ? (item.pdfY_base - item.pdfY_top)
      : ascenderPx;

    // Hard line breaks matching original PDF line structure (text.split('\n'))
    const rawLinesText = text.split('\n');
    const lines = [];

    // Calculate line height using ACTUAL PDF-derived line height.
    const pdfLineHeight = item.lineHeight
      ? item.lineHeight
      : (r.h > 0 && origLines && origLines.length > 0)
        ? (r.h / scale) / origLines.length
        : baseFontSizePt * 1.2;
    const lineHeightPt = pdfLineHeight;

    let globalCharOffset = 0;
    let overflowUnitsFromPrevLine = [];

    for (let pIdx = 0; pIdx < rawLinesText.length || overflowUnitsFromPrevLine.length > 0; pIdx++) {
      const pText = pIdx < rawLinesText.length ? rawLinesText[pIdx] : '';
      const isLineUnedited = overflowUnitsFromPrevLine.length === 0 &&
                              pIdx < initialLinesText.length &&
                              pText === initialLinesText[pIdx];
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
            const useItalicU = ucm.charIsItalic != null ? ucm.charIsItalic : isItalic;
            const useBoldU = ucm.charIsBold != null ? ucm.charIsBold : isBold;
            const useFamilyU = ucm.charFont
              ? `"${sanitizeFontName(stripSubset(ucm.charFont))}", ${currentFontFamily}`
              : currentFontFamily;
            const glyphSzU = (ucm.kind === 'super' || ucm.kind === 'sub') ? baseFontSizePt * 0.65 : baseFontSizePt;
            ctx.font = `${useItalicU ? 'italic ' : ''}${useBoldU ? 'bold ' : ''}${glyphSzU}px ${useFamilyU}`;
            unitWidth += ctx.measureText(ucm.displayChar).width;
          }
          lineUnits.push({ chars: currentUnitChars, width: unitWidth });
          currentUnitChars = [];
        }
      }

      if (currentUnitChars.length > 0) {
        let unitWidth = 0;
        for (const ucm of currentUnitChars) {
          const useItalicU = ucm.charIsItalic != null ? ucm.charIsItalic : isItalic;
          const useBoldU = ucm.charIsBold != null ? ucm.charIsBold : isBold;
          const useFamilyU = ucm.charFont
            ? `"${sanitizeFontName(stripSubset(ucm.charFont))}", ${currentFontFamily}`
            : currentFontFamily;
          const glyphSzU = (ucm.kind === 'super' || ucm.kind === 'sub') ? baseFontSizePt * 0.65 : baseFontSizePt;
          ctx.font = `${useItalicU ? 'italic ' : ''}${useBoldU ? 'bold ' : ''}${glyphSzU}px ${useFamilyU}`;
          unitWidth += ctx.measureText(ucm.displayChar).width;
        }
        lineUnits.push({ chars: currentUnitChars, width: unitWidth });
      }

      // Combine overflow units from previous line with current line units.
      // If content is carrying over from the PREVIOUS original PDF line (pIdx-1)
      // into THIS one, that boundary was a hard newline in the source — not a real
      // space character. Insert a synthetic space unless the previous line ended in
      // a hyphen (genuine word-break continuation, e.g. "prac-" + "tice"), where
      // direct concatenation is correct and no space should be added.
      let allUnitsForLine = [...overflowUnitsFromPrevLine, ...lineUnits];
      if (overflowUnitsFromPrevLine.length > 0 && lineUnits.length > 0) {
        const lastOverflowUnit = overflowUnitsFromPrevLine[overflowUnitsFromPrevLine.length - 1];
        const lastOverflowChar = lastOverflowUnit?.chars?.[lastOverflowUnit.chars.length - 1]?.origChar;
        const firstNewChar = lineUnits[0]?.chars?.[0]?.origChar;
        const isHyphenContinuation = lastOverflowChar === '-' || lastOverflowChar === '\u00AD';
        const alreadyHasSpace = lastOverflowChar === ' ' || lastOverflowChar === '\u00A0' ||
                                 firstNewChar === ' ' || firstNewChar === '\u00A0';
        if (!isHyphenContinuation && !alreadyHasSpace) {
          const spaceMeta = { origChar: ' ', displayChar: ' ', kind: 'normal', charIndex: -1 };
          const spaceUnit = { chars: [spaceMeta], width: ctx.measureText(' ').width };
          allUnitsForLine = [...overflowUnitsFromPrevLine, spaceUnit, ...lineUnits];
        }
      }

      // Keep citation units atomic across reflow: a unit consisting only of
      // super/sub chars (an orphaned superscript) must re-attach to the
      // previous unit instead of starting a line alone.
      for (let u = 1; u < allUnitsForLine.length; u++) {
        const un = allUnitsForLine[u];
        if (un.chars.length > 0 && un.chars.every(c => c.kind === 'super' || c.kind === 'sub')) {
          allUnitsForLine[u - 1] = {
            chars: [...allUnitsForLine[u - 1].chars, ...un.chars],
            width: allUnitsForLine[u - 1].width + un.width,
          };
          allUnitsForLine.splice(u, 1);
          u--;
        }
      }
      overflowUnitsFromPrevLine = [];

      const pOrigLine = (origLines && Array.isArray(origLines) && origLines[pIdx]) ? origLines[pIdx] : null;
      const { line_x0, line_x1 } = getOrigLineBounds(pOrigLine, pIdx);
      const pLineTargetW = Math.max(1, (line_x1 - line_x0));
      const pStartX = (line_x0 - item.pdfX);

      let currentLineUnits = [];
      let currentLineWidth = 0;

      const pushLine = (unitsToPush, isLastCanvasLineOfBlock = false) => {
        const lineChars = unitsToPush.flatMap(u => u.chars);
        const lineStr = lineChars.map(c => c.origChar).join('');
        const lineIdx = lines.length;

        const isLastLineOfParagraph = (pIdx >= rawLinesText.length - 1) && isLastCanvasLineOfBlock;

        const pdfChars = expandMultiCharEntries(pOrigLine?.chars || []);
        const pdfNonSpaceChars = pdfChars.filter(ch => {
          const c = ch.c ?? ch.char ?? '';
          return c !== ' ' && c !== '\u00A0' && c.length > 0;
        });

        // Calculate the exact baseline (dominant origin_y) for normal text on this line
        let dominantPdfOriginY = null;
        const normalOriginYs = pdfChars
          .filter(ch => !ch.is_superscript && !ch.is_subscript && ch.origin_y != null)
          .map(ch => ch.origin_y);
        if (normalOriginYs.length > 0) {
          const counts = {};
          for (const y of normalOriginYs) {
            const rounded = Math.round(y * 10) / 10; // bucket to 0.1pt precision
            counts[rounded] = (counts[rounded] || 0) + 1;
          }
          let maxCount = 0;
          for (const [y, count] of Object.entries(counts)) {
            if (count > maxCount) {
              maxCount = count;
              dominantPdfOriginY = parseFloat(y);
            }
          }
        }

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

        const isReflowedLine = allUnitsForLine.length > lineUnits.length;
        // PDF coordinate anchoring is only valid for lines byte-identical to the
        // PDF. Edited lines must use pure canvas flow layout, otherwise the
        // anchored tail overprints newly typed text.
        const usePdfAnchoring = !isReflowedLine && isLineUnedited;

        let prefixMatchCount = 0;
        let linePrefixStartWordIdx = 0;
        if (usePdfAnchoring && pdfWords.length > 0) {
          const matchIdx = lineWords.indexOf(pdfWords[0]);
          if (matchIdx >= 0) {
            linePrefixStartWordIdx = matchIdx;
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
        }

        // Match trailing non-space characters (suffix) to preserve original PDF trailing kerning shifted by deltaX
        // Disable suffix matching on reflowed lines (lines with overflow from previous lines) to avoid invalid negative shifts
        let suffixMatchCount = 0;
        if (usePdfAnchoring) {
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

        const isPurePrefixOrUnedited = usePdfAnchoring && (prefixMatchCount === pdfNonSpaceChars.length);
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
                const firstPrefixPdfX0 = (pdfNonSpaceChars[0].x0 - item.pdfX);
                testDeltaX = testX - firstPrefixPdfX0;
                testDeltaXComputed = true;
              }
              testX = (pdfCh.x1 - item.pdfX) + testDeltaX + testExtraSpaceShift;
              testPdfCharIdx++;
              testPrevWasSpace = false;
            } else if (isSpace && testPdfCharIdx > 0 && testPdfCharIdx < prefixMatchCount) {
              if (!testPrevWasSpace) {
                const nextPdfCh = pdfNonSpaceChars[testPdfCharIdx];
                testX = (nextPdfCh.x0 - item.pdfX) + testDeltaX + testExtraSpaceShift;
              } else {
                ctx.font = isSuper ? superFont : baseFont;
                const extraW = ctx.measureText(cm.displayChar).width;
                testExtraSpaceShift += extraW;
                testX += extraW;
              }
              testPrevWasSpace = true;
            } else if (!isSpace && testNonSpaceCounter >= suffixStartNonSpaceIdx && suffixMatchCount > 0) {
              if (!testDeltaXComputed && firstSuffixPdfIdx >= 0 && firstSuffixPdfIdx < pdfNonSpaceChars.length) {
                const firstSuffixPdfX0 = (pdfNonSpaceChars[firstSuffixPdfIdx].x0 - item.pdfX);
                testDeltaX = testX - firstSuffixPdfX0;
                testDeltaXComputed = true;
              }
              const suffixPdfIdx = pdfNonSpaceChars.length - (lineNonSpaceChars.length - testNonSpaceCounter);
              if (suffixPdfIdx >= 0 && suffixPdfIdx < pdfNonSpaceChars.length) {
                const pdfCh = pdfNonSpaceChars[suffixPdfIdx];
                testX = (pdfCh.x1 - item.pdfX) + testDeltaX;
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


        let nonSpaceCounter = 0;
        let spacesEncountered = 0;
        let extraSpaceShift = 0;
        let prevWasSpace = false;

        for (let i = 0; i < lineChars.length; i++) {
          const cm = lineChars[i];
          const isSpace = cm.origChar === ' ' || cm.origChar === '\u00A0';
          const isSuper = cm.kind === 'super' || cm.kind === 'sub';

          if (!isSpace && pdfCharIdx < prefixMatchCount) {
            const pdfCh = pdfNonSpaceChars[pdfCharIdx];
            // Use PDF origin_x directly — no deltaXShift needed.
            // PDF coordinates are already relative to item.pdfX (paragraph block left edge).
            const pdfOriginX = (Number.isFinite(pdfCh.origin_x) ? pdfCh.origin_x : pdfCh.x0) - item.pdfX;
            charXPositions.push(pdfOriginX);
            
            // Advance accumX to next character's origin (or x1 for last char)
            const nextPdfCh = pdfNonSpaceChars[pdfCharIdx + 1];
            if (nextPdfCh) {
              accumX = (Number.isFinite(nextPdfCh.origin_x) ? nextPdfCh.origin_x : nextPdfCh.x0) - item.pdfX;
            } else {
              accumX = pdfCh.x1 - item.pdfX;
            }
            pdfCharIdx++;
            prevWasSpace = false;
          } else if (isSpace && pdfCharIdx > 0 && pdfCharIdx < prefixMatchCount) {
            // ── PREFIX SPACE ──
            if (!prevWasSpace) {
              const nextPdfCh = pdfNonSpaceChars[pdfCharIdx];
              // Advance to next character's origin_x (not x0)
              const nextPdfOriginX = (Number.isFinite(nextPdfCh.origin_x) ? nextPdfCh.origin_x : nextPdfCh.x0) - item.pdfX;
              charXPositions.push(accumX);
              accumX = nextPdfOriginX;
            } else {
              // Consecutive spaces in prefix: use canvas measurement
              charXPositions.push(accumX);
              ctx.font = isSuper ? superFont : baseFont;
              accumX += ctx.measureText(cm.displayChar).width;
            }
            spacesEncountered++;
            prevWasSpace = true;
          } else if (!isSpace && nonSpaceCounter >= suffixStartNonSpaceIdx && suffixMatchCount > 0) {
            const suffixPdfIdx = pdfNonSpaceChars.length - (lineNonSpaceChars.length - nonSpaceCounter);
            if (suffixPdfIdx >= 0 && suffixPdfIdx < pdfNonSpaceChars.length) {
              const pdfCh = pdfNonSpaceChars[suffixPdfIdx];
              // Use PDF origin_x directly — no deltaXShift needed
              const suffixOriginX = (Number.isFinite(pdfCh.origin_x) ? pdfCh.origin_x : pdfCh.x0) - item.pdfX;
              charXPositions.push(suffixOriginX);
              const nextSuffixCh = pdfNonSpaceChars[suffixPdfIdx + 1];
              if (nextSuffixCh) {
                accumX = (Number.isFinite(nextSuffixCh.origin_x) ? nextSuffixCh.origin_x : nextSuffixCh.x0) - item.pdfX;
              } else {
                accumX = pdfCh.x1 - item.pdfX;
              }
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

        let yBaseline;
        if (pOrigLine && Number.isFinite(dominantPdfOriginY) && Number.isFinite(item.pdfY_top)) {
          // Use this line's actual PDF baseline (relative to block top), not
          // a uniform lineHeightPt. This preserves non-uniform PDF leading.
          yBaseline = dominantPdfOriginY - item.pdfY_top;
        } else {
          yBaseline = lineIdx * lineHeightPt + firstLineBaselineOffsetPt;
        }
        const yTop = yBaseline - ascenderPx;

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
          lineHeightPt,
          dominantPdfOriginY,
          usesPdfAnchoring: usePdfAnchoring,
        });
      };

      if (isLineUnedited) {
        currentLineUnits = allUnitsForLine;
      } else {
        const OUTER_OVERFLOW_TOLERANCE_PT = 1.5;
        for (let uIdx = 0; uIdx < allUnitsForLine.length; uIdx++) {
          const unit = allUnitsForLine[uIdx];
          const isFirstInLine = currentLineUnits.length === 0;

          if (currentLineWidth + unit.width <= pLineTargetW + OUTER_OVERFLOW_TOLERANCE_PT || isFirstInLine) {
            currentLineUnits.push(unit);
            currentLineWidth += unit.width;
          } else {
            // Unit exceeds target width of current line — push remaining units to overflow for next line!
            overflowUnitsFromPrevLine = allUnitsForLine.slice(uIdx);
            break;
          }
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
            lineHeightPt: lineObj.lineHeightPt,
            lineIndex: lineIdx,
            // Run-aware caret metadata
            kind: cm.kind || 'normal',
            charFontSize: cm.pdfSize || null,
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
              lineHeightPt: lineObj.lineHeightPt,
              lineIndex: lineIdx
            };
          }
        }
      }
    });

    // Fill any missing unmapped indices by interpolating from adjacent mapped indices
    let lastValidPos = { x: 0, yTop: 0, yBaseline: firstLineBaselineOffsetPt, lineHeightPt, lineIndex: 0 };
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
      lineHeightPt: lastLine ? lastLine.lineHeightPt : lineHeightPt,
      lineIndex: lines.length - 1
    };

    const nativeDpr = window.devicePixelRatio || 1;
    const dpr = Math.min(nativeDpr * SUPERSAMPLE_FACTOR, MAX_EFFECTIVE_DPR);
    return { lines, baseFont, superFont, ascenderPx, lineHeightPt, globalCharMap, dpr };
  }, [text, item, scale, fontSizeAdj, currentFontFamily, isBold, isItalic, blockAlign, getOrigLineBounds, r.h, initialLinesText]);

  /**
   * Sequential X-Advance Tracking & Superscript Y-Elevation rendering per line
   */
  const drawCanvasLine = useCallback((ctx, line, layout, fontSizePt, defaultColor) => {
    let currentX = line.startX || 0;
    const dpr = layout?.dpr || Math.min((window.devicePixelRatio || 1) * SUPERSAMPLE_FACTOR, MAX_EFFECTIVE_DPR);
    const totalScale = dpr * scale;

    for (let i = 0; i < line.chars.length; i++) {
      const cm = line.chars[i];
      const isSuper = cm.kind === 'super';
      const isSub = cm.kind === 'sub';

      // Per-character font: fall back to block-level style for new/edited characters that have no charFont
      const useItalic = cm.charIsItalic != null ? cm.charIsItalic : isItalic;
      const useBold = cm.charIsBold != null ? cm.charIsBold : isBold;
      const useFontFamily = cm.charFont
        ? `"${sanitizeFontName(stripSubset(cm.charFont))}", ${currentFontFamily}`
        : currentFontFamily;

      // PREVENT SYNTHETIC BOLD/ITALIC (Faux Bold)
      // If the font file itself is already bold (e.g. "HelveticaNeueLTStd-Bd"),
      // adding "bold " to the CSS font string forces the browser to apply synthetic bolding
      // on top of the bold font, doubling the stem thickness.
      const fontHasBold = /bold|black|heavy|semibold|-bd/i.test(useFontFamily);
      const fontHasItalic = /italic|oblique|-it$|-it\b/i.test(useFontFamily);

      const applyBold = useBold && !fontHasBold;
      const applyItalic = useItalic && !fontHasItalic;

      // Use exact PDF font size for super/subscripts if available; fall back to proportional heuristic
      let currentFontSizePt = fontSizePt;
      if ((isSuper || isSub) && cm.pdfSize) {
        currentFontSizePt = cm.pdfSize; // Exact PDF point size
      } else if (isSuper || isSub) {
        currentFontSizePt = fontSizePt * 0.65; // Fallback for newly typed text
      }
      const glyphSizePt = currentFontSizePt;
      ctx.font = `${applyItalic ? 'italic ' : ''}${applyBold ? 'bold ' : ''}${glyphSizePt}px ${useFontFamily}`;

      ctx.fillStyle = cm.color || defaultColor || '#000000';

      // Use exact PDF baseline delta when available; fall back to heuristics for newly typed text
      let yPos = line.yBaseline;
      if ((isSuper || isSub) && line.usesPdfAnchoring && cm.pdfOriginY != null && line.dominantPdfOriginY != null) {
        // In PDF space (top-down), superscript origin_y < normal baseline origin_y.
        // Positive pdfShiftY means the char sits above the baseline — subtract to move UP on canvas.
        const pdfShiftY = line.dominantPdfOriginY - cm.pdfOriginY;
        yPos = line.yBaseline - pdfShiftY;
      } else if (isSuper) {
        yPos = line.yBaseline - (0.38 * fontSizePt); // Fallback for newly typed text
      } else if (isSub) {
        yPos = line.yBaseline + (0.15 * fontSizePt); // Fallback for newly typed text
      }

      const rawX = (line.charXPositions && line.charXPositions[i] != null) ? line.charXPositions[i] : currentX;
      
      // Allow the browser's native sub-pixel positioning to handle fractional coordinates
      // (DirectWrite/CoreText will shift RGB sub-pixels to keep text crisp without blurring stems).
      ctx.fillText(cm.displayChar, rawX, yPos);


      const charW = ctx.measureText(cm.displayChar).width;
      const extra = (line.extraPerSpace && (cm.origChar === ' ' || cm.origChar === '\u00A0')) ? line.extraPerSpace : 0;
      currentX = rawX + charW + extra;
    }
  }, [isBold, isItalic, currentFontFamily, scale]);

  const coverageRef = useRef(null);
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Forces the canvas to use the exact same sRGB gamma color blending as the DOM
    // text layer, eliminating the dark alpha-blended edge bleed.
    const ctx = canvas.getContext('2d', { alpha: false, colorSpace: 'srgb' });
    if (!ctx) return;

    try {
      const nativeDpr = window.devicePixelRatio || 1;
      const dpr = Math.min(nativeDpr * SUPERSAMPLE_FACTOR, MAX_EFFECTIVE_DPR);

      // 1. Temporary Layout Pass to determine total required height
      const initialLayout = computeLineLayout(ctx);
      const numOrigLines = (origLines && origLines.length) || 1;
      const extraLines = Math.max(0, initialLayout.lines.length - numOrigLines);
      const requiredHeightPt = (r.h / scale) + extraLines * initialLayout.lineHeightPt;
      const requiredHeightPx = requiredHeightPt * scale;
      const deltaH = requiredHeightPx - r.h;

      const HEIGHT_CHANGE_THRESHOLD = 0.5; // ignore sub-pixel noise
      if (
        onHeightChange &&
        (lastReportedDeltaHRef.current === null ||
          Math.abs(deltaH - lastReportedDeltaHRef.current) > HEIGHT_CHANGE_THRESHOLD)
      ) {
        lastReportedDeltaHRef.current = deltaH;
        onHeightChange(item.pdfY, deltaH);
      }

      // 2. Set exact dimensions using r.w and r.h (Zero-Distortion)
      const canvasW = Number.isFinite(r.w) ? Math.max(1, Math.round(r.w * dpr)) : 1;
      const canvasH = Number.isFinite(requiredHeightPx) ? Math.max(1, Math.round(requiredHeightPx * dpr)) : 1;

      canvas.width = canvasW;
      canvas.height = canvasH;
      // Exact 1:1 mapping to prevent compositor scaling blur
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${canvasH / dpr}px`;

      if (coverageRef.current) {
        coverageRef.current.style.width = `${cssW}px`;
        coverageRef.current.style.height = `${canvasH / dpr}px`;
      }

      ctx.scale(dpr, dpr);
      ctx.scale(scale, scale);
      // Disable hinting to render unhinted vector paths matching PDF.js behavior
      ctx.textRendering = 'geometricPrecision';
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const pdfW = r.w / scale;
      const pdfH = requiredHeightPx / scale;
      ctx.clearRect(0, 0, pdfW, pdfH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pdfW, pdfH);

      // Draw text-stripped underlay (images + vector art with text removed).
      // Rendered server-side at 144 dpi so badges/arrows appear correctly
      // without bleed-through from the PDF's own text layer.
      if (item.underlay) {
        const u = item.underlay;
        const uKey = `__underlay__${u.data.slice(0, 32)}`;
        if (!imgCache.current[uKey]) {
          const el = new Image();
          el.src = `data:image/${u.ext};base64,${u.data}`;
          imgCache.current[uKey] = el;
        }
        const el = imgCache.current[uKey];
        const ux = u.rect[0] - item.pdfX;
        const uy = u.rect[1] - item.pdfY_top;
        const uw = u.rect[2] - u.rect[0];
        const uh = u.rect[3] - u.rect[1];
        if (el.complete && el.naturalWidth > 0) {
          ctx.drawImage(el, ux, uy, uw, uh);
        } else {
          el.onload = () => renderCanvas();
        }
      }

      // Draw inline images (e.g. ORCID iD badge, symbol glyphs) that overlap
      // this paragraph block. Coordinates are in PDF-point space.
      const inlineImages = item.inlineImages || [];
      for (const im of inlineImages) {
        const x = im.bbox[0] - item.pdfX;
        const y = im.bbox[1] - item.pdfY_top;
        const w = im.bbox[2] - im.bbox[0];
        const h = im.bbox[3] - im.bbox[1];
        if (!imgCache.current[im.data]) {
          const el = new Image();
          el.src = `data:image/${im.ext};base64,${im.data}`;
          imgCache.current[im.data] = el;
        }
        const el = imgCache.current[im.data];
        if (el.complete && el.naturalWidth > 0) {
          ctx.drawImage(el, x, y, w, h);
        } else {
          el.onload = () => renderCanvas();
        }
      }

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

          ctx.fillRect(xStart, line.yTop, Math.max(0.5, xEnd - xStart), line.lineHeightPt);
        }
      }

      // 5. Draw Text using exact baseFontSizePt
      const baseFontSizePt = item.fontSize + (fontSizeAdj / scale);
      for (const line of layout.lines) {
        drawCanvasLine(ctx, line, layout, baseFontSizePt, color);
      }

      // 6. Blinking Caret Bar (2 CSS pixels wide = 2 / scale PDF points)
      if (isFocused && selection.start === selection.end && caretVisible) {
        const pos = layout.globalCharMap[selection.start] ?? layout.globalCharMap.at(-1);
        if (pos) {
          const baseFontPt = item.fontSize + (fontSizeAdj / scale);
          const isSup = pos.kind === 'super' || pos.kind === 'sub';
          // Run-sized font string for measuring the caret's actual ascent/descent
          const runPt = isSup ? (pos.charFontSize || baseFontPt * 0.65) : baseFontPt;
          const rise  = pos.kind === 'super' ? baseFontPt * 0.30
                      : pos.kind === 'sub'   ? -baseFontPt * 0.10
                      : 0;
          ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${runPt}px ${currentFontFamily}`;
          let asc = runPt * 0.75;
          let desc = runPt * 0.20;
          try {
            const m = ctx.measureText('|');
            if (m.actualBoundingBoxAscent != null && !isNaN(m.actualBoundingBoxAscent)) {
              asc  = m.actualBoundingBoxAscent;
              desc = m.actualBoundingBoxDescent ?? runPt * 0.20;
            }
          } catch { /* keep estimates */ }
          ctx.fillStyle = color || '#000';
          ctx.fillRect(pos.x, pos.yBaseline - rise - asc, 2 / scale, asc + desc);
        }
      }
    } catch (err) {
      console.error('[CanvasInlineEditor] layout failed, cancelling edit', err);
      onCancel();
      return;
    }
  }, [r.w, r.h, computeLineLayout, selection, drawCanvasLine, color, isFocused, caretVisible, item.pdfY, onHeightChange, scale, item.fontSize, fontSizeAdj, cssW, onCancel, isItalic, isBold, currentFontFamily]);

  useLayoutEffect(() => {
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

    const pdfClickX = clickX / scale;
    const pdfClickY = clickY / scale;

    // Exact vertical line bounding box lookup (yMin to yMax)
    let targetLine = layout.lines[0];
    for (let l = 0; l < layout.lines.length; l++) {
      const line = layout.lines[l];
      const yMin = line.yTop;
      const yMax = line.yTop + line.lineHeightPt;
      if (pdfClickY >= yMin && pdfClickY < yMax) {
        targetLine = line;
        break;
      }
      if (pdfClickY >= yMax) {
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

    if (pdfClickX <= charX[0]) return firstOffset;
    if (pdfClickX >= charX[len]) return lastOffset;

    for (let i = 0; i < len; i++) {
      const xLeft = charX[i];
      const xRight = charX[i + 1];
      const xMid = (xLeft + xRight) / 2;

      if (pdfClickX < xMid) {
        const cm = lineChars[i];
        return (cm && cm.charIndex >= 0) ? cm.charIndex : (targetLine.charStartOffset + i);
      }
    }
    return lastOffset;
  }, [text.length, scale]);

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
        const targetOffset = getCharOffsetFromPoint(currentX * scale, (targetLine.yTop + 0.1) * scale);

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
    // Use the authoritative charMeta model — never re-parse from text.
    const newRanges = extractRangesFromCharMeta(charMetaRef.current);
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[CanvasInlineEditor commit]', cleanText, newRanges);
    }

    const canvas = canvasRef.current;
    let computedLines = [];
    if (canvas && canvas._layout && canvas._layout.lines) {
      computedLines = canvas._layout.lines.map(l => l.text);
    }

    onCommit(
      cleanText,
      { fontSizeAdj, color, fontFamily, isBold, isItalic, lines: computedLines, align: blockAlign },
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
          width: `${cssW}px`,
          height: `${cssH_initial}px`,
          backgroundColor: '#ffffff',
          zIndex: 99,
          pointerEvents: 'none',
          willChange: 'transform',
          contain: 'strict',
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
          width: `${cssW}px`,
          height: `${cssH_initial}px`,
          zIndex: 100,
          cursor: 'text',
          outline: '1px dashed rgba(148, 163, 184, 0.8)',
          outlineOffset: '-1px',
          backgroundColor: '#ffffff',
          transform: keyboardOffset ? `translateY(${-keyboardOffset}px)` : undefined,
          willChange: 'transform',
          contain: 'strict',
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
          const newEnd   = e.target.selectionEnd;

          // ── Splice charMeta parallel array (keeps attribute model authoritative) ──
          // Compute common prefix p and suffix window so we know what changed.
          const old = textRef.current;
          const neu = newText;
          let p = 0;
          while (p < old.length && p < neu.length && old[p] === neu[p]) p++;
          let so = old.length, sn = neu.length;
          while (so > p && sn > p && old[so - 1] === neu[sn - 1]) { so--; sn--; }

          const oldMeta = charMetaRef.current;
          const leftMeta  = p > 0 ? oldMeta[p - 1] : null;
          const rightMeta = so < old.length ? oldMeta[so] : null;
          const leftKind  = leftMeta?.kind  ?? 'normal';
          const rightKind = rightMeta?.kind ?? 'normal';

          // Characters that plausibly extend a citation run: digits + citation separators.
          const CIT_CHAR = /[0-9,.\-–—]/;

          // Build inserted meta sequentially so multi-char pastes evaluate left-to-right.
          const inserted = [];
          let prevKind = leftKind;
          let prevMeta = leftMeta;
          for (const ch of neu.slice(p, sn)) {
            let kind = 'normal';
            let color = undefined;
            let pdfSize = undefined;

            const strictlyInside =
              (prevKind === 'super' || prevKind === 'sub') && prevKind === rightKind;

            // NEW — run-END continuation: caret at the end of a super/sub run extends
            // the run, but only for citation-class characters (prevents format bleed
            // into body text typed immediately after a citation).
            const tailExtend =
              (prevKind === 'super' || prevKind === 'sub') &&
              prevKind !== rightKind &&
              CIT_CHAR.test(ch) &&
              prevMeta?.origChar != null &&
              CIT_CHAR.test(prevMeta.origChar);

            if (strictlyInside || tailExtend) {
              kind = prevKind;
              color = prevMeta?.color;
              pdfSize = prevMeta?.pdfSize;
            }
            const meta = { origChar: ch, displayChar: ch, kind, color, pdfSize, charIndex: 0 };
            inserted.push(meta);
            prevKind = kind;
            prevMeta = meta;
          }

          charMetaRef.current = [
            ...oldMeta.slice(0, p),
            ...inserted,
            ...oldMeta.slice(so),
          ].map((m, i) => ({ ...m, charIndex: i }));

          textRef.current    = newText;
          selectionRef.current = { start: newStart, end: newEnd };

          setText(newText);
          setSelection({ start: newStart, end: newEnd });
          setCaretVisible(true);

          requestAnimationFrame(() => { isTypingRef.current = false; });
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
