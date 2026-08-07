---
archived: 2026-08-05T23:50:31.045698
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Production Refactor of `_should_merge` & `_heal_rect_splits`

We have applied the clean production refactor to `backend/pdf_routes/editor.py`:

1. **Production `_should_merge` with Invariant Warning Docstring**
   - Removed temporary `_merge_decision` helper.
   - Entrenched actual text line extent calculation (`a_y1` and `b_y0` from line structures) to compute `v_gap = b_y0 - a_y1`.
   - Included explicit `CRITICAL` docstring warning future maintainers why block bboxes must not be used for vertical gap calculation.

2. **Clean `_heal_rect_splits` & `_merge_blocks`**
   - Retained `_merge_blocks` block union and alignment re-detection logic.
   - Restored clean `_heal_rect_splits` loop and paragraph ID re-indexing (`p_{page_idx}_{idx}`).

---

### Verification
- **Unit Tests**: `test_heal_rect_splits.py` executed 3 tests in 0.001s and passed (`OK`).
- **Archived Walkthrough**: Archived to `changelog/`.
