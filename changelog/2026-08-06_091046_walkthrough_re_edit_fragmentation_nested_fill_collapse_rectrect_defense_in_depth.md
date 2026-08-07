---
archived: 2026-08-06T09:10:46.576659
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Re-edit Fragmentation: Nested Fill Collapse + rect+rect Defense-in-Depth

## Root Cause
`apply_redactions(graphics=PDF_REDACT_LINE_ART_NONE)` never removes line-art, so each bake's fill rect survives. Re-baking stacks a second (larger) fill rect on top of the first. `_innermost_rect` then assigns inner lines to the inner fill and overflow lines to the outer fill → two `rect` regions → `_heal_rect_splits` refuses `rect→rect` → fragmentation.

---

## Fix 1 — `_collect_enclosing_rects`: drop inner fill-only rects (already applied)

Tracks `fill_only` per drawing. After deduplication, any fill-only rect strictly contained in another fill-only rect is dropped with a `[RECTS] dropping nested redaction fill` debug log. Stroked rects are never eligible for dropping.

---

## Fix 2 — `_merge_decision`: rect+rect defense-in-depth (new)

Relaxes the kind guard to allow `rect+rect` when `b["bbox"][1] < a["bbox"][3] - 1.0` (b starts inside a's vertical extent — the overflow-assigned-to-outer-fill scenario). Disjoint table cells (`b["bbox"][1] >= a["bbox"][3]`) still hit `kind_mismatch`.

```python
a_kind = a.get("region_kind")
b_kind = b.get("region_kind")
if a_kind != "rect" or b_kind not in ("gap", "line", "rect"):
    return False, "kind_mismatch", d
if b_kind == "rect":
    if not (b["bbox"][1] < a["bbox"][3] - 1.0):
        return False, "kind_mismatch", d
```

---

## Unit Tests (6/6 OK)
| Test | Result |
|---|---|
| `test_collect_enclosing_rects_drops_nested_fill_only` | ✅ |
| `test_should_merge_rect_rect_nested_overflow` | ✅ (new) |
| `test_should_not_merge_rect_rect_disjoint_table_cells` | ✅ (new) |
| `test_should_merge_valid_overflow` | ✅ |
| `test_should_not_merge_table_cells` | ✅ |
| `test_should_not_merge_different_fonts` | ✅ |
