---
archived: 2026-08-04T11:03:52.106495
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Robust Inter-Word Space Width Inference

## Problem
In many PDFs, space characters (`" "`) are not explicitly stored as character tokens in the `rawdict` stream; instead, words are positioned via coordinate jumps. Consequently, `_build_advance_table(rawdict_chars, fontsize)` would return `None` for `" "`, causing `space_adv` to collapse to fallback values (e.g., `0.25em`). For proportional or justified text, this resulted in unnaturally narrow spaces where inserted words visually crashed into each other.

## Fix
Updated [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py#L650-L677) within the MINIMAL-DIFF editing pipeline:

1. **Gap Detection:** Iterates through consecutive non-space characters in `rawdict_chars`.
2. **Space Width Calculation:** For origin-to-origin jumps exceeding `0.6 * fontsize`, subtracts the character advance of the current letter to isolate the net inter-word whitespace.
3. **Median Selection & Justification Support:** Uses the median of all inferred space widths across the line to account for paragraph justification and kerning variations.
4. **Fallback Chain:** Falls back to `_get_space_width()` only if no valid inter-word gaps can be measured.

```python
if space_adv is None or space_adv < fontsize * 0.15:
    inferred_spaces = []
    for i in range(len(rawdict_chars) - 1):
        curr_char = rawdict_chars[i].get("c", "")
        next_char = rawdict_chars[i+1].get("c", "")
        if curr_char.strip() and next_char.strip():
            curr_x = rawdict_chars[i]["origin"][0]
            next_x = rawdict_chars[i+1]["origin"][0]
            gap = next_x - curr_x
            if gap > fontsize * 0.6:
                char_w = advance_table.get(curr_char, avg_letter_adv)
                inferred_space = gap - char_w
                if inferred_space > fontsize * 0.1:
                    inferred_spaces.append(inferred_space)

    if inferred_spaces:
        inferred_spaces.sort()
        space_adv = inferred_spaces[len(inferred_spaces) // 2]
        logger.info(f"Inferred space_adv={space_adv:.2f} from {len(inferred_spaces)} inter-word gaps")
```

## Verification
- Verified code changes applied cleanly in [`backend/converter/pdf_edit.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/pdf_edit.py).
- Launched automated test suite (`pytest backend/test_challenge_pdf_edit.py`).
