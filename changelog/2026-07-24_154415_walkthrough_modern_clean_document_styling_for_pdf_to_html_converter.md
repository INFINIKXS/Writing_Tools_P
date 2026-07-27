---
archived: 2026-07-24T15:44:15.551526
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\917a5a31-4816-4df7-a2f3-5ba3f4593fc5\walkthrough.md
---

# Walkthrough — Modern Clean Document Styling for PDF to HTML Converter

We resolved why converting a PDF back to HTML produced a raw, unstyled document in Times New Roman with dark background boxes and crude `"PAGE 1 OF 2"` banners.

## Root Cause Analysis

In [`backend/converter/__init__.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/__init__.py#L2787), the `pdf-to-html` converter wrapped each page's raw `get_text("html")` in:
- A dark background container (`background: #0f172a`).
- Hardcoded `"PAGE 1 OF 2"` uppercase page headers.
- Default PDF font fallback strings (e.g. `font-family: NimbusSans, serif`), which caused web browsers (Chrome/Edge) to fall back to default **Times New Roman** serif typography.
- Missing embedded images from the source PDF.

---

## Fixes Applied

Updated `_run_pdf_to_html_sync` in [`backend/converter/__init__.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/__init__.py#L2787):

1. **Modern Responsive Typography**:
   - Replaced raw PDF font fallbacks (`font-family: ..., serif`) with clean modern system fonts: `font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
2. **Clean Web Document Layout**:
   - Removed crude `"PAGE 1 OF 2"` headers and dark background containers (`#0f172a`).
   - Replaced with clean white document page cards (`.document-page`) inside a centered responsive container (`max-width: 900px`) on a soft neutral slate background (`#f1f5f9`).
3. **Base64 Embedded Images**:
   - Extracted all embedded images from the PDF (`doc.extract_image(xref)`) and encoded them directly as base64 data URIs (`data:image/...;base64,...`), so graphics and logos in the PDF render natively inside the HTML document.

---

## Verification Results

Executed an end-to-end API conversion test on `testing_doc.pdf` via `/api/convert/pdf-to-html`:
- **Submit Status**: `202 Accepted` (`job_id: 066a42a3-7abb-4baf-9ebb-2148870e4ca6`)
- **Job Status**: `done` (`filename: testing_doc.html`)
- **Download Status**: `200 OK`
- **Output HTML**: Clean, responsive web document rendered with modern sans-serif typography.
