import { activeFileId } from './pdfEditStore';

const store = new Map(); // docId -> normalized typography data object
const listeners = new Set();

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (e) {
      console.error('Error in pdfTypographyStore listener:', e);
    }
  }
}

/**
 * Normalizes typography payload from /extract-spacing or /extract-typography
 */
function normalizePayload(payload) {
  if (!payload) {
    return { doc_id: null, total_pages: 0, total_paragraphs: 0, pages: [] };
  }

  let pages = [];
  let docId = null;

  if (Array.isArray(payload)) {
    pages = payload;
  } else if (payload && Array.isArray(payload.pages)) {
    pages = payload.pages;
    docId = payload.doc_id || null;
  }

  let totalParagraphs = 0;
  pages.forEach((p) => {
    if (p && Array.isArray(p.blocks)) {
      totalParagraphs += p.blocks.length;
    }
  });

  return {
    doc_id: docId,
    total_pages: pages.length,
    total_paragraphs: totalParagraphs,
    pages,
    rawPayload: payload,
  };
}

export const pdfTypographyStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Set typography metadata for docId (or default active document).
   * Supports setTypographyData(docId, payload) or setTypographyData(payload).
   */
  setTypographyData(docIdOrPayload, maybePayload) {
    let docId = activeFileId;
    let payload = null;

    if (typeof docIdOrPayload === 'string') {
      docId = docIdOrPayload;
      payload = maybePayload;
    } else {
      payload = docIdOrPayload;
    }

    if (!payload) {
      store.delete(docId);
    } else {
      store.set(docId, normalizePayload(payload));
    }
    emit();
  },

  /**
   * Get raw or normalized typography data for docId.
   */
  getTypographyData(docId = activeFileId) {
    const id = typeof docId === 'string' ? docId : activeFileId;
    return store.get(id) || null;
  },

  /**
   * Get paragraphs / blocks for a specific pageIndex.
   * Supports getParagraphsForPage(docId, pageIndex) or getParagraphsForPage(pageIndex).
   */
  getParagraphsForPage(docIdOrPageIndex, maybePageIndex) {
    let docId = activeFileId;
    let pageIndex = 0;

    if (typeof docIdOrPageIndex === 'number') {
      pageIndex = docIdOrPageIndex;
    } else {
      docId = docIdOrPageIndex || activeFileId;
      pageIndex = maybePageIndex ?? 0;
    }

    const data = this.getTypographyData(docId);
    if (!data || !data.pages) return [];

    const pageData =
      data.pages.find((p) => p.page === pageIndex || p.pageIndex === pageIndex) ||
      data.pages[pageIndex];

    return pageData && Array.isArray(pageData.blocks) ? pageData.blocks : [];
  },

  /**
   * Find paragraph whose bounding box contains (x, y) in PDF coordinates.
   * Supports getParagraphAt(docId, pageIndex, x, y) or getParagraphAt(pageIndex, x, y).
   */
  getParagraphAt(arg1, arg2, arg3, arg4) {
    let docId = activeFileId;
    let pageIndex = 0;
    let x = 0;
    let y = 0;

    if (typeof arg1 === 'number') {
      pageIndex = arg1;
      x = arg2;
      y = arg3;
    } else {
      docId = arg1 || activeFileId;
      pageIndex = arg2;
      x = arg3;
      y = arg4;
    }

    const paragraphs = this.getParagraphsForPage(docId, pageIndex);
    if (!paragraphs || paragraphs.length === 0) return null;

    for (const p of paragraphs) {
      if (p.bbox && Array.isArray(p.bbox) && p.bbox.length === 4) {
        const [x0, y0, x1, y1] = p.bbox;
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          return p;
        }
      } else if (p.rect) {
        const { x: rx, y: ry, w: rw, h: rh } = p.rect;
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
          return p;
        }
      }
    }
    return null;
  },

  /**
   * Returns summary of all unique font names, sizes, colors, and paragraph counts used in the document.
   */
  getFontSummary(docId = activeFileId) {
    const id = typeof docId === 'string' ? docId : activeFileId;
    const data = this.getTypographyData(id);

    if (!data || !data.pages) {
      return {
        fontNames: [],
        fontFamilies: [],
        fontSizes: [],
        fontColors: [],
        totalParagraphs: 0,
        breakdown: [],
      };
    }

    const fontNamesSet = new Set();
    const fontSizesSet = new Set();
    const fontColorsSet = new Set();
    const usageMap = new Map();
    let totalParagraphs = 0;

    data.pages.forEach((page) => {
      if (!page.blocks) return;
      page.blocks.forEach((p) => {
        totalParagraphs++;
        const family = p.font_family || p.fontName || 'Unknown';
        const size = p.font_size || p.fontSize || 0;
        const color = p.hex_color || p.font_color || p.color || '#000000';

        if (family) fontNamesSet.add(family);
        if (size) fontSizesSet.add(size);
        if (color) fontColorsSet.add(color);

        const key = `${family}__${size}__${color}`;
        if (!usageMap.has(key)) {
          usageMap.set(key, {
            fontFamily: family,
            fontSize: size,
            fontColor: color,
            count: 0,
          });
        }
        usageMap.get(key).count++;
      });
    });

    const fontNames = Array.from(fontNamesSet);
    const fontSizes = Array.from(fontSizesSet).sort((a, b) => a - b);
    const fontColors = Array.from(fontColorsSet);
    const breakdown = Array.from(usageMap.values());

    return {
      fontNames,
      fontFamilies: fontNames,
      fontSizes,
      fontColors,
      totalParagraphs,
      breakdown,
    };
  },

  /**
   * Clear typography data for docId.
   */
  clear(docId = activeFileId) {
    const id = typeof docId === 'string' ? docId : activeFileId;
    store.delete(id);
    emit();
  },
};
