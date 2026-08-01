---
archived: 2026-08-01T10:38:27.108202
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Multi-Page Document-Wide Trace CID Recovery

Updated `_inject_cmap` in [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py) to scan all pages of the document (`doc`) during Trace CID Recovery, rather than relying only on the single page passed into `_inject_cmap`.

## Problem & Motivation

PDF subset fonts often distribute glyph usage across multiple pages. When trace recovery scanned only the current single page, characters appearing elsewhere in the document (such as `9` or `%`) were omitted from `unicode_to_gid`, leading to unmapped codepoints.

## Changes Made

### Backend Font Pipeline ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

1. **Multi-Page Scanning**:
   - Updated Trace CID Recovery loop to iterate over `pages_to_scan = doc if doc is not None else ([page] if page else [])`.
   - Scans every page (`for pg in pages_to_scan: for span in pg.get_texttrace(): ...`) to collect all Unicode codepoint to GID mappings across the whole document.

2. **Conflicting GID Cross-Page Safety Check**:
   - Added guard for cross-page GID consistency:
     ```python
     if ucp in unicode_to_gid and unicode_to_gid[ucp] != gid:
         logger.warning(f"Conflicting GID for U+{ucp:04X} across pages: {unicode_to_gid[ucp]} vs {gid} — keeping first seen")
         continue
     ```
