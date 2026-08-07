---
archived: 2026-08-06T02:06:40.785109
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Re-edit Fragmentation Fix: Nested Redaction Fill Collapse

## Root Cause
Every bake paints a **fill-only rect** into the page content stream. Repeated bakes accumulate nested fill-only rects. `_innermost_rect` then partitions the paragraph's lines across the nested rects into multiple `rect` regions — and `_heal_rect_splits` cannot merge `rect → rect` (hits `kind_mismatch`), causing fragmentation.

## Fix: `_collect_enclosing_rects` now drops inner fill-only rects

Tracks `fill_only = fill is not None and color is None` for every collected rect. After deduplication, collapses all fill-only rects that are **strictly contained** within another fill-only rect:

```python
nested = fo and any(
    o_fo and (o is not r) and
    o.x0 <= r.x0 + 0.5 and o.y0 <= r.y0 + 0.5 and
    o.x1 >= r.x1 - 0.5 and o.y1 >= r.y1 - 0.5
    for o, o_fo in deduped
)
if nested:
    logger.debug(f"[RECTS] dropping nested redaction fill ...")
    continue
out.append(r)
```

**Safety guarantees:**
- Only `fill-only` (no-stroke) rects can be dropped — stroked table cells / figure borders are always preserved.
- Only rects **strictly contained** in another fill-only rect are dropped — side-by-side cells can never contain each other.
- The outermost fill always survives, so all lines fall into one `rect` region → one box, correct width, alignment re-detected over all lines.
- On the next re-edit, overflow lines fall outside the outer fill as `gap`, and `_heal_rect_splits` merges them normally.

## Unit Tests (4/4 passed)
- `test_collect_enclosing_rects_drops_nested_fill_only` — two nested fill-only + one stroked rect → returns outer fill + stroked only ✅
- `test_should_merge_valid_overflow` ✅
- `test_should_not_merge_table_cells` ✅
- `test_should_not_merge_different_fonts` ✅
