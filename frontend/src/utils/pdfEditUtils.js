import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Converts screen DOM coordinates to PDF user space coordinates.
 *
 * Screen DOM origin is top-left (0,0) with Y increasing downward.
 * PDF user space origin is bottom-left (0,0) with Y increasing upward.
 *
 * @param {number} domX - X position in screen pixels (or scaled canvas pixels)
 * @param {number} domY - Y position in screen pixels (or scaled canvas pixels)
 * @param {number} domW - Width in screen pixels
 * @param {number} domH - Height in screen pixels
 * @param {number} scale - Viewport zoom scale factor
 * @param {number} pageHeight - Raw unscaled PDF page height in points
 * @returns {{ pdfX: number, pdfY: number, pdfW: number, pdfH: number }}
 */
export function domToPdfCoords(domX, domY, domW, domH, scale, pageHeight) {
  const s = scale || 1.0;
  const pdfX = domX / s;
  const pdfW = domW / s;
  const pdfH = domH / s;
  // Convert top-down Y to bottom-up PDF Y
  const pdfY = pageHeight - (domY / s) - pdfH;

  return { pdfX, pdfY, pdfW, pdfH };
}

/**
 * Parses CSS color strings (hex, rgb, rgba) into pdf-lib rgb() objects.
 *
 * @param {string} colorStr
 * @returns {any} pdf-lib rgb object
 */
export function parsePdfColor(colorStr) {
  if (!colorStr) return rgb(0, 0, 0);

  // Hex format (#RGB or #RRGGBB)
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
  }

  // rgb(...) or rgba(...) format
  const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    return rgb(
      parseInt(rgbMatch[1], 10) / 255,
      parseInt(rgbMatch[2], 10) / 255,
      parseInt(rgbMatch[3], 10) / 255
    );
  }

  return rgb(0, 0, 0);
}

/**
 * Finds the PDF.js text layer span element directly under a client cursor position.
 *
 * @param {MouseEvent|PointerEvent} event
 * @param {HTMLElement} textLayerDiv
 * @returns {HTMLSpanElement|null}
 */
export function detectSpanUnderCursor(event, textLayerDiv) {
  if (!textLayerDiv) return null;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  if (element && textLayerDiv.contains(element)) {
    return element.closest('span');
  }
  return null;
}

/**
 * Burns all accumulated user edits and canvas annotations into a PDF document using pdf-lib.
 *
 * @param {ArrayBuffer} pdfBytes - Raw input PDF ArrayBuffer
 * @param {Array<Object>} annotations - Text edits & redaction annotations
 * @param {Array<Object>} canvasAnnotations - Canvas drawings, shapes, sticky notes, highlights
 * @returns {Promise<Uint8Array>} Modified PDF file bytes
 */
export async function burnEditsToPdf(pdfBytes, annotations = [], canvasAnnotations = []) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();

  // Pre-embed standard fonts
  const fontMap = {
    'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
    'Times-Roman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
    'Courier': await pdfDoc.embedFont(StandardFonts.Courier),
  };

  // 1. Process Text Edits & Redactions
  for (const ann of annotations) {
    if (ann.pageIndex < 0 || ann.pageIndex >= pages.length) continue;
    const page = pages[ann.pageIndex];
    const { height } = page.getSize();
    const scale = ann.scale || 1.0;

    const pdfX = ann.x / scale;
    const pW = (ann.width || 100) / scale;
    const pH = (ann.height || 20) / scale;

    if (ann.type === 'redact') {
      const pdfY = height - (ann.y / scale) - pH;
      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pW,
        height: pH,
        color: rgb(1, 1, 1), // Whiteout rect
      });
    } else {
      const fontName = ann.font || 'Helvetica';
      const font = fontMap[fontName] || fontMap['Helvetica'];
      const fontSize = ann.size || 16;
      const pdfY = height - (ann.y / scale) - fontSize;
      const textColor = parsePdfColor(ann.color || '#000000');

      // Optional whiteout behind modified text if specified
      if (ann.whiteoutOriginal && ann.originalWidth && ann.originalHeight) {
        const whiteoutY = height - (ann.originalY / scale) - (ann.originalHeight / scale);
        page.drawRectangle({
          x: ann.originalX / scale,
          y: whiteoutY,
          width: ann.originalWidth / scale,
          height: ann.originalHeight / scale,
          color: rgb(1, 1, 1),
        });
      }

      if (ann.text) {
        page.drawText(ann.text, {
          x: pdfX,
          y: pdfY,
          font,
          size: fontSize,
          color: textColor,
        });
      }
    }
  }

  // 2. Process Canvas Annotations (Highlights, Freehand paths, Shapes, Sticky Notes)
  for (const ann of canvasAnnotations) {
    if (ann.pageIndex < 0 || ann.pageIndex >= pages.length) continue;
    const page = pages[ann.pageIndex];
    const { height } = page.getSize();

    if (ann.type === 'highlight' || (ann.type === 'shape' && ann.shapeType === 'rect')) {
      const pdfX = ann.x;
      const pdfY = height - ann.y - ann.height;
      const fillColor = parsePdfColor(ann.fillColor || ann.color || '#FFD700');
      const strokeColor = ann.strokeColor ? parsePdfColor(ann.strokeColor) : undefined;

      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: ann.width,
        height: ann.height,
        color: fillColor,
        borderColor: strokeColor,
        borderWidth: ann.strokeWidth || 0,
        opacity: ann.opacity ?? (ann.type === 'highlight' ? 0.45 : 1.0),
      });
    } else if (ann.type === 'sticky_note' && ann.text) {
      const pdfX = ann.x;
      const fontSize = 12;
      const pdfY = height - ann.y - fontSize;
      const font = fontMap['Helvetica'];

      // Sticky note background card
      page.drawRectangle({
        x: pdfX,
        y: height - ann.y - 40,
        width: 140,
        height: 40,
        color: parsePdfColor(ann.color || '#FFD700'),
        opacity: 0.9,
      });

      page.drawText(ann.text, {
        x: pdfX + 5,
        y: pdfY - 10,
        font,
        size: fontSize,
        color: rgb(0, 0, 0),
      });
    }
  }

  return await pdfDoc.save();
}
