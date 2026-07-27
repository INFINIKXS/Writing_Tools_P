import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { burnEditsToPdf, domToPdfCoords, parsePdfColor } from './pdfEditUtils';

export { burnEditsToPdf, domToPdfCoords, parsePdfColor };

/**
 * Modifies an existing PDF loaded as a Javascript ArrayBuffer by drawing absolute-positioned
 * texts on top of any desired page before serializing it seamlessly to a Blob for download.
 * 
 * Accurately implements coordinate-space conversion mapping browser canvas to raw PDF DPI.
 */
export async function applyTextAnnotations(pdfBytes, textAnnotations, canvasAnnotations = []) {
  return await burnEditsToPdf(pdfBytes, textAnnotations, canvasAnnotations);
}

