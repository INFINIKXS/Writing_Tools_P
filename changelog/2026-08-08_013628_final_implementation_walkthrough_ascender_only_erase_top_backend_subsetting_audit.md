---
archived: 2026-08-08T01:36:28.334197
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\60a5c1f3-7d3a-4ec0-9142-9adc7d41fae0\walkthrough.md
---

# Final Implementation Walkthrough: Ascender-Only Erase Top & Backend Subsetting Audit

## Overview

This walkthrough documents the final tightening of `erase_rect` top padding (`ey0`) to ascender-only (`top - 1.0pt`), protecting headings (e.g., "CONCLUSION") sitting 2–3pt above body text from accidental redaction clipping.

---

## Key Changes

### Ascender-Only Erase Top Padding (`backend/converter/pdf_edit.py`)
```python
ys = [float(r["baselineY"]) for r in manifest]
if ys:
    mb = edit.get("manifestBbox")
    top = float(mb["y0"]) if isinstance(mb, dict) else (min(ys) - plan["fontsize"] * 0.9)
    ey0 = max(0, top - 1.0)                      # ascender + 1pt ONLY
    ey1 = min(y0 + edit["rect"]["h"] + 2, max(ys) + plan["fontsize"] * 0.5)
    erase_rect = fitz.Rect(max(0, x0 - 2), ey0, x0 + edit["rect"]["w"] + 2, ey1)
else:
    erase_rect = fitz.Rect(max(0, x0 - 2), max(0, y0 - 2),
                           x0 + edit["rect"]["w"] + 2, y0 + edit["rect"]["h"] + 2)
logger.info(f"[ERASE] clamped erase_rect=[{erase_rect.x0:.1f}, {erase_rect.y0:.1f}, {erase_rect.x1:.1f}, {erase_rect.y1:.1f}]")
plan["erase_rects"].append(erase_rect)
```

---

## Backend `subset_fonts` Audit Result

Grep output confirming exactly 2 executable call sites in the backend:

```
c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools_Production\backend\converter\font_utils.py:260:    31 bytes; subset_fonts() then prepends a 7-byte 'ABCDEF+' tag, so any
c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools_Production\backend\converter\pdf_edit.py:2443:            doc.subset_fonts()
c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools_Production\backend\converter\pdf_edit.py:2445:            logger.warning(f"subset_fonts() failed (non-fatal): {e}")
c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools_Production\backend\converter\pdf_edit.py:2481:        doc.subset_fonts()
c:\Users\Paradox-Labs\Documents\Projects\Writing_Tools_Production\backend\converter\pdf_edit.py:2483:        logger.warning(f"optimize: subset_fonts failed (non-fatal): {e}")
```

- Line 260 in `font_utils.py`: Docstring comment.
- Line 2443 in `pdf_edit.py`: Gated block in `apply_edits` (`if optimize == "1": doc.subset_fonts()`).
- Line 2481 in `pdf_edit.py`: Standalone `/optimize` export route (`@router.post("/optimize")`).

---

## Verification & Status

- **Syntax Validation**: `font_utils.py` and `pdf_edit.py` parsed cleanly (`code 0`).
- **Heading Safety**: "CONCLUSION" heading and surrounding titles survive completely intact.
- **Architecture Reference**: Updated [`docs/pdf_editor_bake_pipeline_architecture.md`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/docs/pdf_editor_bake_pipeline_architecture.md) (v1.5.0 frozen).

---
