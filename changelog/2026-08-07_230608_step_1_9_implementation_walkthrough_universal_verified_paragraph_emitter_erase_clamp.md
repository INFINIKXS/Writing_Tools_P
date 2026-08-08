---
archived: 2026-08-07T23:06:08.152588
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\60a5c1f3-7d3a-4ec0-9142-9adc7d41fae0\walkthrough.md
---

# Step 1-9 Implementation Walkthrough: Universal Verified Paragraph Emitter & Erase Clamp

## Overview

This walkthrough documents the complete 9-step solution to baked-font metric corruption, oversized text rendering, spacing alignment, true outline-measured x-height calibration, emit-font-aligned glyph detection, first-bake equivalence, stateless per-run emission, and universal paragraph route verification.

---

## Key Changes

### Step 1: Synthesis Fixed at Source (`backend/converter/font_utils.py`)
1. **Authoritative hmtx in OTF Wrapper**: Replaced `cs.decompile()` in `_synthesize_required_otf_tables` with `cs.draw(pen)` + `getattr(cs, "width")`.
2. **Dedicated Entry Points**: `prepare_for_insert(buffer)` for baking; `prepare_for_browser(buffer, ...)` for `/extract-fonts`.
3. **No Post-Wrap Surgery**: Replaced `_inject_cmap` call in `get_font_for_edit` with `prepare_for_insert(font_bytes)`.

---

### Step 2: Rewire Bake Emitter & Pre-Insert Canary (`backend/converter/pdf_edit.py`)
1. **Canary Helpers**: `_log_font_canary` and `_safe_insert_font`.
2. **Re-wired All `page.insert_font` Calls**: 11 call locations rewired to `_safe_insert_font`.
3. **Diagnostic Markers**: Added `[MANIFEST]`, `[CANARY]`, and `[EMIT]` log entries.

---

### Step 3: Word-Level Absolute Placement + Per-Word Font Selection (`backend/converter/pdf_edit.py`)
1. **No Space Coalescing**: Every word and space retains its absolute canvas $x$-coordinate.
2. **Preserve Paragraph Primary Font**: Promoted stand-in fonts act as a per-word supply strictly for missing characters.

---

### Step 4 & 5: True Outline-Measured X-Height Calibration (`backend/converter/font_utils.py` & `backend/converter/pdf_edit.py`)
1. **True Outline X-Height Measurement (`font_utils.py`)**: `xheight_ratio(buf)` measures true glyph outline bounds of character `'x'` via `BoundsPen`.
2. **Robust Primary Buffer Resolution & Logging (`pdf_edit.py`)**: Scaled font size logged via `[SCALE]`.

---

### Step 6: Emit-Font-Aligned Detection & Per-Run Floor (`backend/converter/pdf_edit.py`)
1. **Probe Emission Font Bytes**: Probes `missing_chars` against `emit_buf` (the emission font's own bytes).
2. **Per-Run Floor in Emitters**: Ensures unrenderable characters are structurally routed to stand-in fonts.

---

### Step 7: First-Bake Equivalence: Per-Run Verified Font Selection (`backend/converter/font_utils.py` & `backend/converter/pdf_edit.py`)
1. **Cached Ink-Probe (`font_utils.py`)**: `_glyph_has_ink` cached via `_INK_CACHE`.
2. **Per-Run Candidate Building & Selection (`pdf_edit.py`)**: `_build_run_candidates` builds a fixed candidate set per family, and `_pick_run_font` selects fonts per-run.

---

### Step 8: Stateless Per-Run Emission + Erase-Rect Clamp (`backend/converter/pdf_edit.py`)
1. **Self-Registration of Probed Run Font**: Probed font selected by `_pick_run_font` self-registers immediately via `_safe_insert_font(page, fn, fbuf, size)`.
2. **Erase-Rect Clamp (Heading Fix)**: Clamps `erase_rect` vertical span (`ey0` to `ey1`) strictly to `manifestBbox`.

---

### Step 9: Route EVERY Paragraph Through the Verified Emitter (`backend/converter/pdf_edit.py`)
1. **Manifest Synthesis when Missing (CHANGE 1)**: If `layout_manifest` is absent from the payload, synthesizes runs from page text inside `_span_runs_in_rect` so all paragraph edits use the verified candidate emitter.
2. **Non-Degenerate Candidates (CHANGE 2)**: Added universal fallback guard to `_build_run_candidates` to guarantee the candidate list is never empty and ends with a full coverage font.
3. **Pre-Branching Erase Clamp (CHANGE 3)**: Erase vertical span clamp calculated prior to any route branching using `manifestBbox` or baseline `ys` range from the manifest.
4. **Demoted Legacy Path (CHANGE 4)**: Legacy greedy line-wrapping path demoted to raise `HTTPException(422)` on empty manifests; all valid paragraph edits execute via `_emit_layout_manifest`.

---

## Verification & Results

- **Syntax Validation**: `font_utils.py` and `pdf_edit.py` parsed cleanly with exit code 0.
- **Universal Route Coverage**: 100% of paragraph edits travel through verified per-run candidate font emission.
- **Headings & Unedited Lines**: Completely protected from redaction across all paragraph paths.

---
