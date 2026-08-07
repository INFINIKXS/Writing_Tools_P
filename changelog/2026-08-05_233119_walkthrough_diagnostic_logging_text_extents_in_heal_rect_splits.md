---
archived: 2026-08-05T23:31:19.262533
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Diagnostic Logging & Text Extents in `_heal_rect_splits`

We have integrated diagnostic logging and updated the `_merge_decision` function in `backend/pdf_routes/editor.py`:

1. **`_merge_decision(a, b)` Diagnostic Function**
   - Calculates text extents using line `line_y1` and `line_y0` with safe default fallback to `bbox[3]` / `bbox[1]`.
   - Returns explicit failure reasons (`kind_mismatch`, `vertical_overlap`, `v_gap_too_large`, `font_size`, `font_family`, `h_overlap`, `left_edge`) and key parameters (`v_gap`, `max_gap`, `h_ovl_ratio`, `left_diff`).

2. **Upstream & Heal Logs**
   - Added `[RECTS]`, `[GROUP]`, and `[REGION]` logs in `extract_page_spacing_data`.
   - Added `[HEAL]` log in `_heal_rect_splits` to trace block-pair evaluation decisions.
   - Configured `logging.getLogger("pdf_routes.editor").setLevel(logging.DEBUG)`.

---

### Verification
- **Unit Tests**: `test_heal_rect_splits.py` ran 3 tests and passed (`OK`).
- **Archived Walkthrough**: Archived to `changelog/`.
