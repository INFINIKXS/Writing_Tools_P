---
archived: 2026-08-07T14:48:10.688358
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\411782e8-470e-40d2-a45e-3fa9f7abf47e\walkthrough.md
---

# Step 4: Coverage-Verification Gate on the Promotion Target

## Summary of Implementation

This step implements an authoritative coverage-verification gate on promotion candidates to guarantee that promotion targets verifiably cover missing characters before being accepted.

### Key Changes Made

1. **`backend/converter/pdf_edit.py`**:
   - Added `_pick_verified_promotion(candidates, bad_chars)` helper function to test candidate buffers against `_find_missing_glyphs()`.
   - Replaced unverified promotion targets in both paragraph edit paths (layout-manifest fast path and run-faithful path) with candidate chain evaluation:
     1. Static target (exact style)
     2. Static target (regular style)
     3. Legacy vault match (exact style)
     4. Universal fallback font
   - Selected candidates are gated through `_pick_verified_promotion()`. If a candidate lacks characters, `GATE: rejected <name>` is logged and the next candidate is evaluated.
   - Re-derived `bad_primary` set against the verified primary font immediately following promotion.

---

## Verification Results

### 1. Gate Negative Test (Proving the Gate)
Simulated a candidate chain where the first candidate was an incomplete subset buffer (`incomplete_subset`) and the second candidate was a full font (`libre-baskerville-Regular`).

**Output:**
```
GATE: rejected 'incomplete_subset' (still missing ['1', '2', '3', 'T', 'k', 'w'])
PROMOTE: paragraph font -> libre-baskerville-Regular (verified covers 6/6; still missing [])
PICKED: libre-baskerville-Regular
GATE NEGATIVE TEST PASSED SUCCESSFULLY!
```

### 2. Test Suite Verification
Running `pytest backend/test_twobake_gauntlet.py backend/test_font_promotion_gauntlet.py backend/test_font_vault_gauntlet.py`:
```
======================== 6 passed in 62.03s (0:01:02) =========================
```
