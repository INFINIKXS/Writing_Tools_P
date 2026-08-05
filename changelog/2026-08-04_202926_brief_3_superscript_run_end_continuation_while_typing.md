---
archived: 2026-08-04T20:29:26.073861
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\5f57d800-5999-4c52-8dab-7606bfdf70bb\walkthrough.md
---

# BRIEF 3 — Superscript Run-End Continuation While Typing

## Summary

This frontend-only update fixes formatting inheritance when typing at the end of a superscript/subscript run (such as numerical citations).

## Key Changes

### [`CanvasInlineEditor.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/PDFEditor/CanvasInlineEditor.jsx)

Replaced the `onChange` `charMetaRef.current` splice logic:
- Added citation character class test regex: `CIT_CHAR = /[0-9,.\-–—]/`
- Implemented sequential insertion processing (`for (const ch of neu.slice(p, sn))`) to support multi-character pastes and sequential character insertion.
- Implemented `tailExtend` condition:
  ```js
  const tailExtend =
    (prevKind === 'super' || prevKind === 'sub') &&
    prevKind !== rightKind &&
    CIT_CHAR.test(ch) &&
    prevMeta?.origChar != null &&
    CIT_CHAR.test(prevMeta.origChar);
  ```
- Evaluates `strictlyInside || tailExtend` to carry forward `kind`, `color`, and `pdfSize` from `prevMeta`.
- Non-citation characters (letters, spaces) typed at the run boundary evaluate `tailExtend = false` and inherit `kind: 'normal'`, preventing formatting bleed into surrounding body text.

## Behavior Matrix

| Caret Position | Typed Char | Inherited Kind |
|---|---|---|
| Middle of super run (super on both sides) | Any | `super` |
| End of super run (last char is digit/separator) | Digit / `,` / `.` / `-` / `–` / `—` | `super` (Extends run) |
| End of super run | Space or letter | `normal` (Bleed protection) |
| Start of super run / plain body text | Any | `normal` |
| Sub runs | Mirror of above | `sub` |

## Verification Matrix

| Check | Expected Result | Status |
|---|---|---|
| `pytest backend/test_challenge_pdf_edit.py` | 5/5 passed | ✅ PASSED |
| Typing `6` after `15` | Extended to `156` as `super` | ✅ Implemented |
| Typing `4` inside `15` (`145`) | Remains `super` | ✅ Implemented |
| Typing ` x` after `15` | Renders at body size | ✅ Implemented |
