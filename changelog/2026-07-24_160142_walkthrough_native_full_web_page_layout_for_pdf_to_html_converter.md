---
archived: 2026-07-24T16:01:42.918818
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\917a5a31-4816-4df7-a2f3-5ba3f4593fc5\walkthrough.md
---

# Walkthrough — Native Full Web Page Layout for PDF to HTML Converter

We resolved the issue where converting a PDF file back to HTML rendered the content as a paper sheet card centered inside a document viewer box rather than expanding full-bleed across the screen as a native web page.

## Changes Made

Updated `_run_pdf_to_html_sync` in [`backend/converter/__init__.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/__init__.py#L2785):

1. **Full-Bleed Web Page Layout**:
   - Removed artificial card boundaries (`.document-page`), card shadows (`box-shadow`), paper margins, and light-grey background containers (`#f1f5f9`).
   - Styled `html, body` to take up 100% width and viewport height with native white background (`#ffffff`) and modern sans-serif typography (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
2. **Responsive Web Page Sections**:
   - Replaced paper sheet cards with responsive `.web-page-section` wrappers (`width: 100%`) so elements flow naturally across the full browser width (`max-width: 1200px`).
   - Stripped hardcoded `pt` container width constraints from PyMuPDF page output (`re.sub(r'style="[^"]*width:\s*\d+\.?\d*pt;[^"]*"', 'style="width:100%; position:relative;"', page_html)`).
3. **Base64 Embedded Images**:
   - Preserved base64 data URI image extraction (`data:image/...;base64,...`) for native graphics and image rendering.

---

## Verification Results

Verified `POST /api/convert/pdf-to-html` end-to-end:
- **Submit Status**: `202 Accepted`
- **Output HTML**: Renders full-width as a web page directly in Chrome/Edge without box framing or document viewer margins.
