---
archived: 2026-08-07T14:09:32.120895
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\283b69f9-a44b-40b9-b11d-5dd03a252deb\walkthrough.md
---

# Font Vault & Typography Pipeline Architecture Specification Created

## Summary of Accomplishments

1. **Created Comprehensive Architecture Document**
   - Created [`docs/font_vault_architecture.md`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/docs/font_vault_architecture.md).
   - Fully documented the end-to-end technical lifecycle of fonts in the PDF editor system.

2. **Key System Sections Covered**:
   - **System Architecture & Mermaid Diagrams**: Full-flow diagrams from PDF upload, subset tag stripping (`ABCDEF+FontName`), CFF-to-OTF shell wrapping, to canvas UI rendering and PDF serialization.
   - **File Sitemap & Component Roles**: Breakdown of [`font_vault.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_vault.py), [`font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py), [`pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py), [`pdf_routes.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/routes/pdf_routes.py), and harvester scripts (`fetch_fonts.py`, `ingest_system_font.py`, `wipe_vault.py`).
   - **Ingestion & Storage Mechanics**: Explanation of directory structure, `manifest.json` schema keyed by `fam_st`, thread locks (`_LOCK`), atomic PID temporary file replacement (`_write_manifest`), `vault_batch_write` context manager, and `_CMAP_LRU` caching.
   - **Canvas & Frontend Communication**: Sequence diagram showing how font availability and page typography JSON are communicated over REST endpoints (`/api/pdf/vault/manifest`, `/api/pdf/editor`).
   - **Missing Glyph Detection & Font Promotion Protocol**: Detailed technical step-by-step trace of how subset fonts lacking characters (e.g. `NewBaskerville-Italic` lacking `['L','N','P','k','w','x']`) trigger render-probe ink checks (`_glyph_has_ink`), dynamic glyph merging, and vault promotion to `libre-baskerville-Italic.ttf`.
   - **Multi-Tier Fallback Chain**: Visual flowchart detailing the 6-level fallback hierarchy (Embedded Subset $\rightarrow$ Glyph Merge $\rightarrow$ Vault Full Font $\rightarrow$ Vault Subset Union $\rightarrow$ Base-14 Alias $\rightarrow$ `pymupdf-fonts`).
   - **Baking & Metric Synchronization**: Explanation of `hmtx` advance width table matching and stem darkening ratio calculation (`stem_vw_ratio`).
