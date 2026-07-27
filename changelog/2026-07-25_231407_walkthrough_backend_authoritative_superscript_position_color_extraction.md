---
archived: 2026-07-25T23:14:07.121445
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\b9325f24-6175-4aa5-902e-965695189e79\walkthrough.md
---

# Walkthrough - Backend-Authoritative Superscript Position & Color Extraction

We updated the superscript/subscript pipeline to be **100% backend-authoritative**, removing all hardcoded color fallbacks:

## 1. Backend Flag & RGB Color Extraction ([backend/pdf_routes/editor.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/pdf_routes/editor.py))
- PyMuPDF inspects font flags (`TEXT_FONT_SUPERSCRIPT` and `TEXT_FONT_SUBSCRIPT`) authoritatively for every character span.
- Converts raw packed sRGB integers (`span.get("color")`) into exact CSS RGB color strings (`span_color_css = f"rgb({r}, {g}, {b})"`) for every superscript and subscript character.

## 2. Dynamic Frontend Color Rendering ([InlineEditor.jsx](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/InlineEditor.jsx))
- Removed all hardcoded fallback colors (`#2563eb`).
- `buildInitialChildren` applies the exact backend RGB string (`r.color`) to `<sup>` and `<sub>` elements, dynamically matching the document's original citation colors.

## Verification
- Verified Vite frontend compilation (`npm run build`).
