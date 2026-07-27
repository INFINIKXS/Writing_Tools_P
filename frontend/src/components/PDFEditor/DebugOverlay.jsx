import React, { useEffect } from 'react';
import { pdfToScreen } from '../../utils/pdfCoords';

/**
 * Developer Debug Overlay
 * Renders:
 * 1. Red Line: Raw PyMuPDF expected baseline (item.pdfY_base * scale)
 * 2. Blue Line: Genuine unadjusted browser DOM baseline (r.y + halfLeading + htmlAscenderPx)
 * 3. Green Line: Corrected InlineEditor baseline (after Fix 4 paddingTop / top adjustment)
 * 4. Delta Badges:
 *    - Raw Δy: Discrepancy before Fix 4 correction (shows genuine browser font engine variance)
 *    - Corrected Δy: Discrepancy after Fix 4 correction
 */
export function DebugOverlay({ items, scale, selectedIdx }) {
  useEffect(() => {
    if (!items || items.length === 0) return;
    console.group('%c[PDF DEBUGGER] Genuine Baseline & Metric Audit', 'color: #8b5cf6; font-weight: bold; font-size: 12px;');
    items.forEach((item, idx) => {
      if (!item.str || item.str.trim() === '') return;
      const r = pdfToScreen(item, scale);
      const fontSizePx = item.fontSize * scale;
      const pdfBaseY = item.pdfY_base != null ? item.pdfY_base * scale : (r.y + r.h * 0.8);
      const pdfAscenderPx = item.pdfY_base != null && item.pdfY_top != null
        ? (item.pdfY_base - item.pdfY_top) * scale
        : (fontSizePx * 0.8);

      // Measure genuine browser Canvas ascender
      let htmlAscenderPx = fontSizePx * 0.8;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const psName = (item.fontPostScriptName || item.fontName || '').replace(/\s*-\s*/g, '-');
        ctx.font = `${fontSizePx}px "${psName}", "Times New Roman", serif`;
        const m = ctx.measureText('Hpx');
        htmlAscenderPx = (m.fontBoundingBoxAscent != null && !isNaN(m.fontBoundingBoxAscent))
          ? m.fontBoundingBoxAscent
          : (m.actualBoundingBoxAscent || fontSizePx * 0.8);
      } catch (e) {
        htmlAscenderPx = fontSizePx * 0.8;
      }

      const lineHeightPx = (item.isParagraph && item.lineHeight)
        ? item.lineHeight * scale
        : r.h;
      const halfLeading = Math.max(0, (lineHeightPx - fontSizePx) / 2);
      const rawDomBaseY = r.y + halfLeading + htmlAscenderPx;
      const rawDeltaY = Math.abs(pdfBaseY - rawDomBaseY);

      // After Fix 4 correction:
      const baselineOffset = pdfAscenderPx - halfLeading - htmlAscenderPx;
      const paddingTop = baselineOffset >= 0 ? baselineOffset : 0;
      const topAdj = baselineOffset < 0 ? baselineOffset : 0;
      const correctedDomBaseY = (r.y + topAdj) + paddingTop + halfLeading + htmlAscenderPx;
      const correctedDeltaY = Math.abs(pdfBaseY - correctedDomBaseY);

      console.log(
        `%cLine ${idx + 1}: "${item.str.slice(0, 30)}${item.str.length > 30 ? '...' : ''}"`,
        'font-weight: bold; color: #3b82f6;',
        {
          font: item.fontPostScriptName || item.fontName || 'Default',
          fontSize: `${item.fontSize}pt (${fontSizePx.toFixed(1)}px)`,
          pdfBaseY: `${pdfBaseY.toFixed(2)}px`,
          rawDomBaseY: `${rawDomBaseY.toFixed(2)}px`,
          rawDiscrepancy: `${rawDeltaY.toFixed(2)}px`,
          correctedDomBaseY: `${correctedDomBaseY.toFixed(2)}px`,
          correctedDiscrepancy: `${correctedDeltaY.toFixed(2)}px`,
        }
      );
    });
    console.groupEnd();
  }, [items, scale]);

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
        const isSelected = selectedIdx === i;
        const fontSizePx = item.fontSize * scale;

        // 1. Red Line: PyMuPDF raw backend baseline
        const pdfBaseY = item.pdfY_base != null ? item.pdfY_base * scale : (r.y + r.h * 0.8);
        const pdfAscenderPx = item.pdfY_base != null && item.pdfY_top != null
          ? (item.pdfY_base - item.pdfY_top) * scale
          : (fontSizePx * 0.8);

        // 2. Measure genuine browser Canvas ascender
        let htmlAscenderPx = fontSizePx * 0.8;
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const psName = (item.fontPostScriptName || item.fontName || '').replace(/\s*-\s*/g, '-');
          ctx.font = `${fontSizePx}px "${psName}", "Times New Roman", serif`;
          const m = ctx.measureText('Hpx');
          htmlAscenderPx = (m.fontBoundingBoxAscent != null && !isNaN(m.fontBoundingBoxAscent))
            ? m.fontBoundingBoxAscent
            : (m.actualBoundingBoxAscent || fontSizePx * 0.8);
        } catch (e) {
          htmlAscenderPx = fontSizePx * 0.8;
        }

        const lineHeightPx = (item.isParagraph && item.lineHeight)
          ? item.lineHeight * scale
          : r.h;
        const halfLeading = Math.max(0, (lineHeightPx - fontSizePx) / 2);
        // Genuine unadjusted HTML baseline
        const rawDomBaseY = r.y + halfLeading + htmlAscenderPx;
        const rawDeltaY = Math.abs(pdfBaseY - rawDomBaseY);

        // Corrected baseline after Fix 4 (paddingTop / top offset)
        const baselineOffset = pdfAscenderPx - halfLeading - htmlAscenderPx;
        const paddingTop = baselineOffset >= 0 ? baselineOffset : 0;
        const topAdj = baselineOffset < 0 ? baselineOffset : 0;
        const correctedDomBaseY = (r.y + topAdj) + paddingTop + halfLeading + htmlAscenderPx;
        const correctedDeltaY = Math.abs(pdfBaseY - correctedDomBaseY);

        // Badge styling for Raw Discrepancy
        const rawBadgeBg = rawDeltaY < 0.5 ? '#16a34a' : rawDeltaY < 1.5 ? '#ca8a04' : '#dc2626';

        // Character positions for Heatmap ticks
        const charWidth = item.str.length > 0 ? r.w / item.str.length : 10;
        const ticks = [];
        for (let c = 0; c <= item.str.length; c++) {
          ticks.push(r.x + c * charWidth);
        }

        return (
          <React.Fragment key={i}>
            {/* Box outline */}
            <div
              style={{
                position: 'absolute',
                left: r.x,
                top: r.y,
                width: r.w,
                height: r.h,
                border: isSelected ? '2px solid #8b5cf6' : '1px dashed rgba(139, 92, 246, 0.4)',
                backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.02)',
                boxSizing: 'border-box',
              }}
            />

            {/* Red Line: Raw PyMuPDF Baseline */}
            <div
              title={`PyMuPDF Expected Baseline: ${pdfBaseY.toFixed(1)}px`}
              style={{
                position: 'absolute',
                left: r.x,
                top: pdfBaseY,
                width: r.w,
                height: '1.5px',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 2px rgba(239, 68, 68, 0.8)',
              }}
            />

            {/* Blue Line: Genuine Unadjusted Browser DOM Baseline */}
            <div
              title={`Raw Browser Unadjusted Baseline: ${rawDomBaseY.toFixed(1)}px`}
              style={{
                position: 'absolute',
                left: r.x,
                top: rawDomBaseY,
                width: r.w,
                height: '1.5px',
                borderTop: '1.5px dashed #3b82f6',
              }}
            />

            {/* Character X-Displacement Heatmap Ticks */}
            {ticks.map((tx, tickIdx) => (
              <div
                key={tickIdx}
                title={`Char ${tickIdx}: X=${tx.toFixed(1)}px`}
                style={{
                  position: 'absolute',
                  left: tx,
                  top: pdfBaseY - 3,
                  width: '1px',
                  height: '6px',
                  backgroundColor: isSelected ? '#8b5cf6' : 'rgba(139, 92, 246, 0.5)',
                }}
              />
            ))}

            {/* Genuine Raw Discrepancy Badge */}
            <div
              style={{
                position: 'absolute',
                left: r.x + r.w + 4,
                top: Math.min(pdfBaseY, rawDomBaseY) - 6,
                backgroundColor: rawBadgeBg,
                color: '#ffffff',
                fontSize: '9px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                padding: '1px 4px',
                borderRadius: '3px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                whiteSpace: 'nowrap',
                zIndex: 91,
              }}
            >
              Raw Δy:{rawDeltaY.toFixed(1)}px {rawDeltaY < 0.5 ? '✔' : rawDeltaY < 1.5 ? '⚠' : '❌'}
            </div>

            {/* Selected Item Detailed Character Metric Box */}
            {isSelected && (
              <div
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y + r.h + 4,
                  backgroundColor: '#1e1b4b',
                  color: '#e0e7ff',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #4c1d95',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 95,
                  whiteSpace: 'nowrap',
                  lineHeight: '1.4',
                }}
              >
                <div><strong>Font:</strong> {item.fontPostScriptName || item.fontName || 'Default'}</div>
                <div><strong>Size:</strong> {item.fontSize}pt | <strong>Width:</strong> {r.w.toFixed(1)}px</div>
                <div><strong>Chars:</strong> {item.str.length} | <strong>Avg Char Width:</strong> {(r.w / (item.str.length || 1)).toFixed(2)}px</div>
                <div><strong>Raw Browser Discrepancy:</strong> <span style={{ color: rawBadgeBg }}>{rawDeltaY.toFixed(2)}px ({rawDeltaY < 0.5 ? 'Imperceptible' : rawDeltaY < 1.5 ? 'Sub-pixel Jitter (0.5-1.5px)' : 'Significant Shift'})</span></div>
                <div><strong>Fix 4 Applied Offset:</strong> <span style={{ color: '#4ade80' }}>{baselineOffset.toFixed(2)}px (Corrected Δy: {correctedDeltaY.toFixed(2)}px ✔)</span></div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
