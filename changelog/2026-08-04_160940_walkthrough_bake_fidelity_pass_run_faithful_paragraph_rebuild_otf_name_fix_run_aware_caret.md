---
archived: 2026-08-04T16:09:40.956719
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\c38fcd32-3b81-4c53-9f32-959e3ed19c28\walkthrough.md
---

# Walkthrough: Bake-Fidelity Pass — Run-Faithful Paragraph Rebuild, OTF Name Fix, Run-Aware Caret

## Task 1: OTF Name Table Fix (`font_utils.py`)

**Root cause:** nameID 4 ("Full Name") was set to the stripped family name; PyMuPDF reads
nameID 4 for `fitz.Font.name` and appends the subfamily string, producing
`"NewBaskerville-Roman Regular"` instead of the exact basefont name.

**Fix:** Set nameID 4 = `ps_name` (full verbatim `basefont_name`) so `fitz.Font.name` exactly
matches the expected value. nameID 6 (PostScript name) was already correct.

---

## Task 2: Run-Faithful Paragraph Bake (`pdf_edit.py`)

### 2a — `charStart`/`charEnd` key fix
Frontend `extractRangesFromCharMeta` emits `charStart`/`charEnd`; backend was reading
`r.get("start", 0)` → always 0. Fixed to `r.get("charStart", r.get("start", 0))`.

### 2b — `fontSize` in `resolved_super_ranges`
Tuples are now 4-wide `(charStart, charEnd, color_rgb, fontSize_or_None)`.
Hex `#rrggbb` and `rgb(r,g,b)` strings are parsed correctly.

### 2c — Original-baseline anchoring
- `left`/`right` come from actual run bboxes (not the padded erase rect)
- `orig_baselines[]` built from distinct `line_y` values in `runs`
- `_baseline_for_line(li)` snaps the first N lines to original positions

### 2d — Per-token size from `resolved_super_ranges`
`tok_size` comes from the carried `r_fs` (explicit PDF fontSize), not the
aggregate `plan["sup_size"]`.

---

## Task 3 (original): Frontend `fontSize` in committed ranges (`CanvasInlineEditor.jsx`)

`extractRangesFromCharMeta` now includes `fontSize: meta.pdfSize || null` so the
backend gets explicit superscript sizes.

---

## BUG 1 — SUP chip removed; metric-based caret (`CanvasInlineEditor.jsx`)

**Root cause:** The previous implementation painted `ctx.fillText("SUP"…)` inside the
caret blink gate — producing a blinking text label on the canvas instead of a bar.

**Fix:** Deleted the entire chip block. The caret now uses `ctx.measureText('|')` against
the run's own font string (`runPt px currentFontFamily`) to obtain `actualBoundingBoxAscent`
/ `actualBoundingBoxDescent` for the caret rect height. For superscript runs:
- `runPt = pos.charFontSize || baseFontPt * 0.65`
- `rise = baseFontPt * 0.30` (super) or `-baseFontPt * 0.10` (sub)
- caret top = `pos.yBaseline - rise - asc`; height = `asc + desc`

No text is ever painted on the editing canvas.

---

## BUG 2 — charMetaRef splice model (`CanvasInlineEditor.jsx`)

**Root cause:** `computeLineLayout` and `handleCommit` both re-called
`parseCharMetadata(text, initialRanges, origLines)` on every render/commit.
After any edit near a superscript run, the positional prefix/suffix char-matching in
`parseCharMetadata` leaked `is_superscript` flags onto adjacent normal chars, producing
corrupted ranges at commit.

**Fix — charMetaRef (parallel array, spliced on input):**

1. `const charMetaRef = useRef(initialParsed.charMeta)` — seeded once at mount.
2. `textarea onChange` diffs old/new text via common prefix `p` / suffix window, then
   splices the parallel array:
   - New chars inherit `kind: 'super'` **only** if strictly inside an existing sup run on
     both sides (Word/Docs inheritance rule).
   - All entries are re-indexed (`charIndex: i`) after the splice.
3. `computeLineLayout` uses `charMetaRef.current` directly — `parseCharMetadata` removed.
4. `handleCommit` uses `extractRangesFromCharMeta(charMetaRef.current)` directly —
   no `parseCharMetadata`, no `origLines`. Debug log emitted in dev.
5. `computeLineLayout` dep array drops `initialRanges` and `origLines` (no longer used).
6. `renderCanvas` dep array gains `isItalic`, `isBold`, `currentFontFamily` (needed for
   the caret font measurement).

---

## Verification
- `pytest backend/test_challenge_pdf_edit.py` → **5/5 passed**
- `parseCharMetadata` now called only in the mount-time `initialParsed` useMemo
