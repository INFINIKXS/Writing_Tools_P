import React, { useState, useEffect } from 'react';
import { pdfToScreen } from '../../utils/pdfCoords';

const stripSubset = (name) => (name || '').replace(/^[A-Z]{6}\+/, '');
const sanitizeFontName = (name) =>
  (name || '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+(Regular|Reg|Bold|Italic|Oblique)$/i, '');

/**
 * Developer Debug Overlay
 * Renders:
 * - DOM vs Canvas font-weight A/B test layer when active
 */
export function DebugOverlay({ items, scale, selectedIdx, debugFontWeightCompare: externalToggle }) {
  const [localCompareToggle, setLocalCompareToggle] = useState(false);
  const debugFontWeightCompare = externalToggle ?? localCompareToggle;

  if (!items || items.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 90,
      }}
    >
      {items.map((item, i) => {
        if (!item.str || item.str.trim() === '') return null;

        const r = pdfToScreen(item, scale);
        const fontSizePx = item.fontSize * scale;

        // Font Weight A/B Test Parameters
        const text = item.str || item.text || '';
        const psName = item.fontPostScriptName || item.fontName || '';
        const isBold = item.isBold || /bold/i.test(psName) || ((item.flags & 2) !== 0);
        const isItalic = item.isItalic || /italic|oblique/i.test(psName) || ((item.flags & 1) !== 0);
        const color = item.color || '#000000';

        const fontCandidates = [
          item.fontPostScriptName,
          stripSubset(item.fontPostScriptName),
          item.fontName,
          stripSubset(item.fontName),
          item.font,
          stripSubset(item.font),
        ].filter(Boolean);
        const uniqueCandidates = [...new Set(fontCandidates)];
        const sanitizedCandidates = uniqueCandidates.map(sanitizeFontName);
        const realFontStack = sanitizedCandidates.map(n => `"${n}"`).join(', ');
        const isSans = sanitizedCandidates.some(n => /helvetica|arial|sans|gothic|verdana|tahoma|trebuchet|roboto/i.test(n));
        const fallbackStack = isSans
          ? 'sans-serif, Arial, "Helvetica Neue", Helvetica'
          : 'serif, "Times New Roman", Georgia';
        const currentFontFamily = item.renderedFontFamily || (realFontStack ? `${realFontStack}, ${fallbackStack}` : fallbackStack);

        return (
          <React.Fragment key={i}>
            {/* DOM-vs-canvas font-weight A/B test element */}
            {debugFontWeightCompare && (
              <div
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y,
                  fontFamily: currentFontFamily,
                  fontSize: `${fontSizePx}px`,
                  color: color,
                  fontWeight: isBold ? 'bold' : 'normal',
                  fontStyle: isItalic ? 'italic' : 'normal',
                  whiteSpace: 'pre',
                  pointerEvents: 'none',
                  zIndex: 101,
                }}
              >
                {text}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
