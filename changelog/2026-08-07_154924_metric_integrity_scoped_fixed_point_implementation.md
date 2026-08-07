---
archived: 2026-08-07T15:49:24.715875
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\411782e8-470e-40d2-a45e-3fa9f7abf47e\walkthrough.md
---

# Metric Integrity & Scoped Fixed-Point Implementation

## Summary of Implementation

This task resolves font advance corruption, fontname aliasing rejections, and cross-family promotion bleed across the PDF rendering and font promotion pipeline.

### Changes Made per Step

1. **CHANGE 1 (P1) — `font_utils.py`**:
   - Added `prepare_font_buffer(buffer)`: Bare CFF buffers are wrapped in OTF containers keeping their own `unitsPerEm`; TTF and OTF buffers pass through byte-for-byte untouched.
   - Guarded `_inject_cmap`: Non-CFF fonts return original `font_bytes` untouched.
   - Updated `get_font_for_edit()` and font extraction routes to route extracted buffers through `prepare_font_buffer()`.

2. **CHANGE 2 (P1 companion) — `pdf_edit.py`**:
   - Added `pdf_safe_alias(name)` to strip space and non-alphanumeric characters (`re.sub(r"[^A-Za-z0-9_+\-]", "-", name)`).
   - Updated Phase 2.5 font registration and promotion blocks to insert and map under safe aliases, eliminating `bad fontname chars {' '}` warnings.

3. **CHANGE 3 (P2) — `editor.py`**:
   - Updated `_merge_line_fragments()` space insertion logic to compute median-based space threshold per line (`space_thr = max(0.5, 2.0 * med)`), preventing glued or intra-word space feedback loops across generations.

4. **CHANGE 4 (P3) — `pdf_edit.py`**:
   - Updated `_emit_layout_manifest()` with `SUP-RUN` debug logging when emitting superscript or subscript runs with their exact `fontSize` and `baselineY`.

5. **CHANGE 5 & 6 (P4 & P5) — Scoped Fixed-Point & Test Suite**:
   - Updated `vault_full_for()` to enforce family scoping via `resolve_root_family()`. Requesting an unmapped/unknown family (e.g. `HelveticaNeueLTStd`) returns `None` / legacy per-family fallback, never defaulting to Libre Baskerville.
   - Added `test_scoped_promotion_invariants` unit test in `backend/test_font_vault_gauntlet.py`.

---

## Verification Results

### Test Suite Output
```
======================== 7 passed in 91.47s (0:01:31) =========================
```
- `backend/test_twobake_gauntlet.py`: PASSED
- `backend/test_font_promotion_gauntlet.py`: PASSED
- `backend/test_font_vault_gauntlet.py`: PASSED (5/5 passed, including `test_scoped_promotion_invariants`)
