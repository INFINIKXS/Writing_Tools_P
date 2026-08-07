---
archived: 2026-08-05T23:14:28.988330
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Heal Redaction-Rect Block Splits in `extract_page_spacing_data`

We have implemented a post-processing heal pass in `backend/pdf_routes/editor.py` that re-attaches overflow blocks to their parent redaction-rect blocks when text expands vertically:

1. **Healing Algorithm (`_heal_rect_splits`, `_should_merge`, `_merge_blocks`)**
   - **`_heal_rect_splits(blocks, page_idx)`**: Iterates top-to-bottom pre-sorted blocks per page. When an adjacent block `b` qualifies as an overflow split from parent block `a`, merges `b` into `a` and re-indexes paragraph IDs cleanly (`p_{page_idx}_{idx}`).
   - **`_should_merge(a, b)`**: Enforces 6 strict, metric-driven criteria:
     - `a` must have `region_kind == "rect"`, `b` must have `region_kind in ("gap", "line")`.
     - Downward adjacent: `-5.0 <= v_gap <= max(3.5, 0.6 * min_font_size)`.
     - Matching font size (`abs(a["font_size"] - b["font_size"]) <= 1.0`).
     - Matching font family (`a["font_family"] == b["font_family"]`).
     - Horizontal overlap `>= 60% min_width`.
     - Same left edge alignment (`abs(a["bbox"][0] - b["bbox"][0]) <= 4.0`).
   - **`_merge_blocks(a, b)`**: Unions bboxes, concatenates text and line structures, and re-evaluates block alignment via `_detect_align_from_lines(m["lines"])`.

2. **Alignment Recovery (`_detect_align_from_lines`)**
   - Re-evaluates line span coverage across merged lines (`touches_left` & `touches_right`).
   - Recovers `align: "justify"` on overflow paragraphs once full merged line count passes the `>= 50%` threshold.

---

### Acceptance Verification
- [x] **Redaction Rect Overflow**: Re-extraction of expanded rect paragraphs merges parent rect and overflow lines into **one** unified block with `align: justify`.
- [x] **Untouched Paragraphs & Methods**: Left/center/right untouched paragraphs remain unaffected.
- [x] **Table Protection**: Cells with differing left edges or fonts are strictly preserved as separate blocks.
- [x] **Unit Tests**: `test_heal_rect_splits.py` created and verified.
