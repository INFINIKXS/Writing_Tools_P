---
archived: 2026-08-06T09:42:44.871142
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Publisher-Calibrated Width Math (run-seg path)

## Root Cause
The run-seg path used `font_obj.text_length(...)` for all wrap/justify/cursor decisions. That font's `hmtx` advances are *nominal* — they lack the publisher's kerning/tracking/justification. Result: wrong line-break points vs the publisher and justified lines that don't reach the column edge.

---

## Patch 1 — `_build_advance_table`: cross-line guard

Added `same_line` check before recording inter-char origin deltas. When the next char is on a new line, `origin.x` resets to the left margin → negative or huge delta → poisons the per-char median. Now skipped with `continue`.

```python
same_line = abs(rawdict_chars[i]["origin"][1] - rawdict_chars[i + 1]["origin"][1]) < 1.0
if not same_line:
    continue
```

---

## Patch 1 (cont.) — rawdict capture pre-redaction (Phase 1)

Immediately after `plan["runs"] = runs`, captures all rawdict chars from the erased region into `plan["raw_chars"]` *before* `apply_redactions()` erases the content. Soft-guarded with `try/except`.

---

## Patch 2 — Calibration block + `_tok_w` (Phase 3)

After `_resolve_fitz_font_object`, builds `advance_table` from `raw_chars` and computes `k_cal` (median ratio of ground-truth advance to `font_obj.text_length` over all printable known chars). Defines `_tok_w(text, size)`:

- For known chars at body size → uses `advance_table[ch]` (publisher ground truth)
- For unknown (newly typed) chars → uses `font_obj.text_length * k_cal`
- When no advance table → falls back to `font_obj.text_length * k_cal`

Logs: `RUN-SEG CALIBRATION: N chars, k=X.XXXX`

---

## Patch 3 — All run-seg width math routed through `_tok_w`

| Site | Before | After |
|---|---|---|
| `space_w` | `font_obj.text_length(" ", body)` | `advance_table.get(" ", font_obj.text_length(" ", body) * k_cal)` |
| `_unit_width` | `font_obj.text_length(t["text"], t["size"])` | `_tok_w(t["text"], t["size"])` |
| `_emit_token` non-fallback return | `font_obj.text_length(token["text"], token["size"])` | `_tok_w(token["text"], token["size"])` |
| `_emit_token` per-char (fallback) | `fb_font.text_length(ch, size)` | `fb_font.text_length(ch, size) * k_cal` |
| `_emit_token` per-char (main) | `font_obj.text_length(ch, size)` | `_tok_w(ch, size)` |
| Pass 1 wrap `tw` | `font_obj.text_length(token["text"], token["size"])` | `_tok_w(token["text"], token["size"])` |
| Pass 2 `nat_w` | `sum(font_obj.text_length(...) ...)` | `sum(_tok_w(...) ...)` |

The flat `insert_textbox` path (non-superscript paragraphs) is untouched.

---

## Verification
- `SYNTAX OK` — `ast.parse` clean
- All 11 spot-checks passed (`OK`)
