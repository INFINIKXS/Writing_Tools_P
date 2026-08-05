---
archived: 2026-08-04T16:40:38.853200
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Bake-Fidelity & Single Index-Space Resolution Pass

## Step 1 — Mandatory Diagnosis Logging Added
- In `CanvasInlineEditor.jsx` (`handleCommit`):
  Log `cleanText` with `JSON.stringify(cleanText)` and every range's `{kind, charStart, charEnd, styled: cleanText.slice(charStart, charEnd)}`.
- In `pdf_edit.py` Phase 3:
  Log `[baker paragraph_text]` and `[baker range]` with the exact substring slice `paragraph_text[charStart:charEnd]`.

## Step 2 — Single Index Space Resolution (`pdf_edit.py`)
- **Root cause of preceding word corruption:** `paragraph_text` in Phase 1 and Phase 3 was previously being constructed as `"\n".join(lines)` where `lines` came from wrapped canvas layout lines. This inserted extra `\n` characters into `paragraph_text` at wrapped line boundaries, shifting all range character indices by +1 per line break and pointing range slices into preceding words.
- **Fix:** Both Phase 1 and Phase 3 now strictly set `paragraph_text` to `new_text` (`plan["new_text"]` / `edit["newStr"]`), guaranteeing 100% 1:1 index alignment between frontend `cleanText` and backend `paragraph_text`.
- **Dev assertion:** Added check in `pdf_edit.py`: if `styled` slice contains letters (`/[A-Za-z]/`), log `SUPERSCRIPT DRIFT DETECTED`.

## Step 3 — Self-Heal on Mount (`CanvasInlineEditor.jsx`)
- In `parseCharMetadata`, added a post-pass over contiguous `super` runs in `charMeta`.
- If a run starts with letters attached to a preceding word and ends in digits/symbols (e.g. `reviews.15`, `checklist.14 46`), demotes the letter prefix (e.g. `reviews.`, `checklist.`) to `normal` while keeping trailing digits/symbols as `super`.
- Logs `[self-heal]` demotion details to console.

## Step 4 — Newline-Join Space Preservation (`pdf_edit.py`)
- In Phase 3 token wrapping:
  - If a space token contains `\n`, `line_idx` is incremented by `count("\n")`, `x` resets to `left`, and `baseline` updates to `_baseline_for_line(line_idx)`. Any trailing indentation spaces after `\n` advance `x`.
  - Non-newline space tokens advance `x` by their measured font width, preventing words on adjacent lines from collapsing together (e.g. `extensionfor` -> `extension for`).

## Verification
- Pytest suite executed: 5/5 passed.
