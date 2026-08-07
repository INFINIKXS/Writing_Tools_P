---
archived: 2026-08-05T23:26:13.910981
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Verbose Diagnostic Logging for `_heal_rect_splits`

We have integrated diagnostic logging into `backend/pdf_routes/editor.py` to trace region classification and decision guards during block extraction:

1. **`_merge_decision(a, b)` Diagnostic Evaluator**
   - Evaluates text line extents (`a_y1` and `b_y0`) to ignore unioned graphic background padding.
   - Logs explicit failure reasons (`kind_mismatch`, `vertical_overlap`, `v_gap_too_large`, `font_size`, `font_family`, `h_overlap`, `left_edge`) alongside decision parameters (`v_gap`, `max_gap`, `h_ovl_ratio`, `left_diff`).

2. **Upstream Classification Trace (`extract_page_spacing_data`)**
   - Added `[RECTS]`: Enclosing rect coordinates collected from page drawings/images.
   - Added `[GROUP]`: Count of rect-assigned lines vs free lines.
   - Added `[REGION]`: Detailed log for each region tuple (`kind`, `col`, `n_lines`, `y_range`, `text_preview`).

3. **`[HEAL]` Merge Trace**
   - Logs initial block list per page with region kind, y-extents, font family/size, and text sample.
   - Logs each pair evaluation: `[HEAL] p_0_0 + p_0_1 -> MERGE {...}` or `[HEAL] p_0_0 + p_0_1 -> kind_mismatch {...}`.

4. **Logger Configuration**
   - Configured `logging.getLogger("pdf_routes.editor").setLevel(logging.DEBUG)` for full verbosity.

---

### Verification
- **Unit Tests**: `test_heal_rect_splits.py` executed and passed (`OK`).
- **Archived Walkthrough**: Archived to `changelog/`.
