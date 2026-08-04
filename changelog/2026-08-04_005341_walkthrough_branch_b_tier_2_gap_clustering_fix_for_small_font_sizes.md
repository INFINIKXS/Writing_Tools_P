---
archived: 2026-08-04T00:53:41.293317
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Branch B Tier 2 Gap-Clustering Fix for Small Font Sizes

## Problem

The PDF paragraph clustering algorithm was fragmenting small-text regions (Abstract at 8–9pt, References at 7.5pt) into per-line boxes instead of grouping them into cohesive paragraphs.

Diagnosis confirmed a **Branch B: Tier 2 Gap-Clustering failure** with two root causes:

### Root Cause A: `v_tol` Collapse
`v_tol` was calculated using `pb.height` (tight bounding box height of characters), which collapses for small text and lines without descenders:
- 10pt text: char height ≈ 8.5pt → `0.6 × 8.5 = 5.1pt` (passes for 4pt line gaps ✅)
- 7.5pt text: char height ≈ 5.5pt → `0.6 × 5.5 = 3.3pt` (fails for 4pt line gaps ❌)

### Root Cause B: Alternating Font Size Artifact
Abstract lines showed alternating 9pt/8pt sizes due to invisible tracking characters (soft-hyphens, zero-width spaces). The raw character `Counter` was equally weighted, allowing these minority characters to skew the dominant font size calculation.

---

## Changes Made

### `backend/pdf_routes/editor.py`

#### Fix 1 — `_cluster_free_lines`: Stabilized `v_tol` using font size metadata
```diff
- v_tol = max(2.0, 0.6 * min(pb.height, nb.height))
+ v_tol = max(3.5, 0.6 * min(prev["size"], nxt["size"]))
```
Font size metadata is stable regardless of whether a line has descenders. Floor raised from 2.0pt to 3.5pt to accommodate standard academic leading.

#### Fix 2 — `extract_page_spacing_data`: Weighted dominant font size by character width
```diff
- dom_font_size = Counter(round(ch["size"], 1) for ch in target_chars).most_common(1)[0][0]
+ total_width = sum(max(0.0, ch["x1"] - ch["x0"]) for ch in target_chars)
+ if total_width > 0:
+     dom_font_size = round(sum(ch["size"] * max(0.0, ch["x1"] - ch["x0"]) for ch in target_chars) / total_width, 1)
+ else:
+     dom_font_size = Counter(round(ch["size"], 1) for ch in target_chars).most_common(1)[0][0]
```
A single 8pt soft-hyphen no longer outvotes twenty 9pt letters.

#### Fix 3 — `[CLUSTER-DEBUG]` print added inside `_cluster_free_lines`
```python
print(f"[CLUSTER-DEBUG] gap={v_gap:.2f} tol={v_tol:.2f} | x_close={x_close} | "
      f"sz={prev['size']:.1f}->{nxt['size']:.1f} | merge={merge_ok} | "
      f"Text: {prev.get('text', '')[:20]!r} -> {nxt.get('text', '')[:20]!r}")
```
Allows tracing which predicate fails on any remaining per-line boxes.

---

## Test Results

```
backend\test_challenge_pdf_edit.py .....  [100%]
5 passed in 85.71s
```

All 5 challenge PDF edit tests passed.

---

## Next Steps (if per-line boxes remain after this fix)
Examine `[CLUSTER-DEBUG]` console output:
- `x_close=False` → horizontal overlap check failing (likely hanging-indent references); consider raising the `h_ovl` overlap threshold.
- `merge=False` with `x_close=True` → font family mismatch; inspect `font_family` values for adjacent lines.
