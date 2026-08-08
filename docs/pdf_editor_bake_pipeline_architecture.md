# PDF Editor Bake Pipeline — Architecture Reference

> **Version**: 1.5.0 (frozen 2026-08-08)  
> **Scope**: `backend/converter/font_utils.py`, `font_vault.py`, `pdf_edit.py`, `pdf_routes/editor.py`, `frontend/src/pages/PDFEditorPage.jsx`  
> **Purpose**: Preserve the invariants that survived the 10-iteration debugging cycle. Every future refactor must respect these rules or the pipeline will regress to invisible glyphs, glued words, or per-generation font drift.

---

## 1. Executive Summary

The bake pipeline takes a paragraph edit from the canvas frontend and re-inserts the modified text into the PDF so that:

- **Every typed character is visible**, no matter which generation of bake it appears in.
- **Original text is pixel-identical** to what the PDF already contained.
- **Word positions and justification** are preserved exactly, immune to substitute-font metric differences.
- **Stand-in fonts** (used for typed words the original subset lacks) are visually calibrated to the original's x-height.
- **Re-extraction** produces the exact text that was typed, spaces included.
- **Bake N+1 behaves exactly like bake 1**, with no cumulative degradation.
- **100% of paragraph edits** travel through the verified candidate emitter with `[PATH]` tracking.
- **Legacy fallback path** includes a safety net querying the vault first.
- **Headings and titles above edited paragraphs** are completely protected from redaction by tightening the erase top to ascender-only (`top - 1.0pt`).
- **Font Subsetting is decoupled from editing**: Inter-edit working copies remain un-subsetted; subsetting occurs strictly at export via `/api/pdf/optimize`.

These properties are achieved through a **stateless per-run, ink-verified font selection** architecture anchored to **two fixed references per family**: the original subset and the vault's full-charset stand-in.

---

## 2. Pipeline Overview

```
Canvas edit ──► POST /api/pdf/apply-edits (optimize=0)
                    │
                    ├─► Phase 1:  Plan extraction (runs, fonts, manifest synthesis if missing, ascender-only erase top)
                    ├─► Phase 2:  Redact the old paragraph (clamped to manifestBbox or ys ascender span)
                    ├─► Phase 2.5: Re-register fonts (post-redaction)
                    ├─► Phase 3:  Build non-degenerate candidates, emit per-run with self-registration
                    │             (Un-subsetted working document returned)
                    └─► Export:   POST /api/pdf/optimize (doc.subset_fonts() + GC for download artifact)
```

**The invariant**: every buffer that reaches `page.insert_font` or `page.insert_text` flows through `prepare_for_insert` (Step 1) and the pre-insert canary (Step 2). Working documents remain un-subsetted to prevent cross-paragraph font degradation during multi-edit sessions.

---

## 3. Detection & Resolution (Step 7, 8, 9 & Heading Protection — `pdf_edit.py`)

### 3.1 Core Rules

1. **Universal Verified Paragraph Emission**: Every paragraph op synthesizes a manifest if missing (`_span_runs_in_rect`), logs `[PATH] paragraph op -> manifest/synthesized verified emitter (N runs)`, and routes through `_emit_layout_manifest`.
2. **Ascender-Only Erase Top**: The top of the erase rect (`ey0`) is tightened to ascender-only (`top - 1.0pt`), calculated via `top = float(mb["y0"]) if isinstance(mb, dict) else (min(ys) - fontsize * 0.9)`. Titles and headings (e.g. "CONCLUSION") sitting 2–3pt above the body ascender are 100% protected from accidental redaction clip.
3. **Authentic-Font Preference Order**: Candidates are ordered starting with paragraph family fonts (original subset), then vault full-charset stand-ins, and ending with a universal fallback.
4. **Legacy Path Safety Net**: If a paragraph ever reaches the legacy textbox path, it checks `_check_font_buf_missing_glyphs`. If glyphs are missing, it queries `vault_full_for(font_name_arg) or resolve_promotion_target(...)` first and logs `[LEGACY-SAFE] ... -> vault ...`.

---

## 4. Subsetting & Packaging (Step 10 — `pdf_edit.py` & `PDFEditorPage.jsx`)

### 4.1 Rules

| # | Rule | Why |
|---|------|-----|
| S1 | `doc.subset_fonts()` is gated in `apply_edits` behind `if optimize == "1":`. Default is `"0"`. | Recompiling shared font programs between intermediate edits drops glyphs referenced by paragraphs that were not edited in that specific turn. |
| S2 | Final packaging uses `@router.post("/optimize")`. | Produces a lean, terminal, subsetted downloadable artifact without affecting the un-subsetted working document in memory. |
| S3 | Frontend `handleFinishAndExport` splits working copy and download copy. | Working document stays intact while the download copy passes through `/optimize`. |
| S4 | Exactly two executable call sites for `doc.subset_fonts()` exist in backend. | Single gated block in `apply_edits` and single block in `optimize_pdf`. |

---

## 5. Maintenance Checklist

When modifying any file in `backend/converter/`:

- [ ] `prepare_for_insert` is still used for every bake-path buffer.
- [ ] `_pick_run_font` is still per-run, not per-paragraph.
- [ ] Self-registration via `_safe_insert_font(page, fn, fbuf, size)` is performed on picked run fonts.
- [ ] `erase_rect` top (`ey0`) is clamped to ascender-only (`top - 1.0pt`).
- [ ] Subsetting is gated (`optimize == "1"`), leaving working documents un-subsetted.
- [ ] `/optimize` endpoint exists for final export packaging.
- [ ] 10-bake gauntlet passes.

---

*End of document.*
