# PDF Editor Bake Pipeline — Architecture Reference

> **Version**: 1.0.0 (frozen 2026-08-07)  
> **Scope**: `backend/converter/font_utils.py`, `font_vault.py`, `pdf_edit.py`, `pdf_routes/editor.py`  
> **Purpose**: Preserve the invariants that survived the 10-iteration debugging cycle. Every future refactor must respect these rules or the pipeline will regress to invisible glyphs, glued words, or per-generation font drift.

---

## 1. Executive Summary

The bake pipeline takes a paragraph edit from the canvas frontend and re-inserts the modified text into the PDF so that:

- **Every typed character is visible**, no matter which generation of bake it appears in.
- **Original text is pixel-identical** to what the PDF already contained.
- **Word positions and justification** are preserved exactly, immune to substitute-font metric differences.
- **Stand-in fonts** (used for typed words the original subset lacks) are visually calibrated to the original's x-height.
- **Re-extraction** produces the exact text that was typed, spaces included.
- **Bake N+1 behaves exactly like bake 1**, with no cumulative degradation.

These properties are achieved through a **per-run, ink-verified font selection** architecture anchored to **two fixed references per family**: the original subset and the vault's full-charset stand-in.

---

## 2. Pipeline Overview

```
Canvas edit ──► POST /api/pdf/apply-edits
                    │
                    ├─► Phase 1:  Plan extraction (runs, fonts, superscript ranges)
                    ├─► Phase 2:  Redact the old paragraph
                    ├─► Phase 2.5: Re-register fonts (post-redaction)
                    ├─► Phase 3:  Build run candidates, emit per-run with ink verification
                    └─► Final:    subset_fonts() + save
```

**The invariant**: every buffer that reaches `page.insert_font` or `page.insert_text` flows through `prepare_for_insert` (Step 1) and the pre-insert canary (Step 2). No font is ever trusted without a render-probe against the exact chars of the run it will paint.

---

## 3. The Font Vault

### 3.1 Physical layout

```
%LOCALAPPDATA%/pdf_editor_font_vault/
├── manifest.json          # per-family metadata, style-keyed (fam_style)
├── family_map.json        # STATIC: root_family → {style: rel_path}
├── aliases.json           # STATIC: substitute_family → root_family
├── full/                  # complete fonts — PROMOTION TARGETS
├── subsets/               # extracted PDF subsets — isolated, never promoted
└── buffers/               # legacy / unclassified
```

### 3.2 Invariants

| # | Rule | Why |
|---|------|-----|
| V1 | `full/` and `subsets/` are **isolated**. `vault_full_for()` must **never** return a buffer from `subsets/`. | Subsets lack arbitrary chars; returning one as a promotion target produces invisible glyphs. The 12:31 regression was exactly this. |
| V2 | `family_map.json` and `aliases.json` are written **only** by harvest tools (`fetch_fonts.py`, `ingest_system_font.py`). **Never by bakes.** | Bakes must not introduce drift; a bake that rewrites the alias table breaks the next bake's lookup. |
| V3 | `register_static_family()` is the only writer of these tables. | Single code path → single point of failure. |
| V4 | Manifest keys are `fam_style` (e.g. `newbaskerville_regular`). Never bare family names. | Prevents Regular/Bold/Italic collision, which caused the "Italic for roman paragraph" cascade. |
| V5 | Auto-ingest from `/extract-fonts` always passes `is_subset=True`. | Polluted the full-font index; vault_cover_for then returned incomplete subsets. |
| V6 | Manifest writes are atomic (`.tmp.{pid}` + retry-with-backoff). | OneDrive sync and Windows Defender both hold handles on freshly written files. |

### 3.3 Harvest tools

- **`tools/fetch_fonts.py`**: Static + CTAN TeX Gyre + Google Fonts API. Registers each downloaded font via `register_static_family` with the commercial family it stands in for.
- **`tools/ingest_system_font.py`**: Scans Windows/Office font dirs. Ingests with `license="local-install (do not redistribute)"`.
- **`tools/wipe_vault.py`**: Nuclear reset with `remove_readonly` handler for Windows locks.

---

## 4. Font Preparation (Step 1 — `font_utils.py`)

### 4.1 Two entry points, never mixed

```python
def prepare_for_insert(buffer):
    """BAKING path. Healthy TTF/OTF passes through byte-identical.
    Bare CFF is wrapped once. No cmap rewrite, no hmtx re-sync."""

def prepare_for_browser(buffer, doc, xref, page, basefont_name):
    """BROWSER path. Wrap + full cmap inject for @font-face.
    Reserved for /extract-fonts ONLY — never use for baking."""
```

### 4.2 Invariants

| # | Rule | Why |
|---|------|-----|
| F1 | A valid TTF/OTF buffer passes through `prepare_for_insert` **byte-for-byte**. | Any table rewrite can corrupt hmtx/unitsPerEm consistency → oversized glyphs or collapsed spacing. The bake-1 "oversized" symptom was exactly this. |
| F2 | `wrap_cff_in_otf` uses `cs.draw(pen)` (not `cs.decompile()`) to read charstring widths. | `cs.decompile()` + `cs.width + nominal_width` is unreliable; many glyphs fall back to `defaultWidthX=500` → collapsed spacing. |
| F3 | The OS/2 table in wrapped CFFs uses synthetic values (`sxHeight=500`). **Never trust OS/2** for x-height — measure the `'x'` glyph bounds with `BoundsPen`. | `xheight_ratio` initially read OS/2 and returned 0.50 for every wrapped font, defeating x-height calibration. |
| F4 | `_inject_cmap` runs only in the browser path. The bake path uses `_glyph_has_ink` render-probe only. | Cmap rewriting corrupts re-extraction in PyMuPDF 1.26.4+; render-probe is 100% reliable. |

---

## 5. Detection & Resolution (Step 7 — `pdf_edit.py`)

### 5.1 The core rule

**Detection moves into the run loop.** Every run is emitted only with a font that provably renders all of its characters, chosen from a fixed candidate set. Paragraph-level promotion is demoted to **candidate building only** — it never replaces the paragraph primary font.

```python
def _build_run_candidates(fam, want_style, font_buffer_map):
    """Fixed reference set for EVERY bake:
       paragraph-family fonts first (original subset etc.),
       vault full font last as universal catch-all."""

def _pick_run_font(text, candidates):
    """First candidate whose ink-probe covers EVERY char of the run;
       last candidate (vault full) is the guaranteed fallback."""
```

### 5.2 Invariants

| # | Rule | Why |
|---|------|-----|
| D1 | `_pick_run_font` is called **per run**, not per paragraph. | Paragraph-level detection + per-paragraph promotion broke on bake 2+ because intermediate subsets entered the resolver. Bake 2 of the NewBaskerville test rendered "Now" → "o" for exactly this reason. |
| D2 | Candidates include the **vault full font as the last entry**, and it is the guaranteed fallback. | Guarantees no run can fail to render. Makes bake N+1 behave identically to bake 1 — both see the same two-reference set. |
| D3 | `_glyph_has_ink` is **cached per (buffer-hash, char)**. | Per-run selection probes many chars; uncached ink-probes would O(100×) slowdown the bake. |
| D4 | The paragraph primary font is **never replaced**. `_pick_run_font` routes per-run only. | Whole-paragraph promotion (Step 3 era) made typed words look like a different typeface; Step 5 demoted promotion; Step 7 finalized by removing the replacement entirely. |
| D5 | Spaces (`text.strip() == ""`) always use the primary font, never a stand-in. | Stand-in spaces would shift every subsequent word; spaces are real runs at real positions, not font-metric computations. |
| D6 | Paragraph-level `bad` / `resolver` / `still` / `fb_name` / `fb_font` / `bad_primary` routing is **deleted** from the manifest fast-path and run-faithful path. | Double logic (paragraph + per-run) was the source of every detection/emit disagreement. One mechanism only. |

---

## 6. Emission (Steps 3 & 4 — `pdf_edit.py`)

### 6.1 Word-level absolute placement

The manifest contains per-run absolute X positions. The emitter honors them:

```python
page.insert_text(fitz.Point(x, y), text, fontname=fn, fontsize=size, color=color)
```

The `_emit_layout_manifest` pre-pass that coalesced space runs into the preceding run is **deleted**. Every word and every space keeps its own absolute X, so inter-word spacing is **position-driven**, not font-metric-driven.

### 6.2 X-height-calibrated stand-in sizing

```python
if fn != primary_fontname:
    scale_f = MANUAL_SIZE_SCALE.get(canonical_family(fn)) or standin_size_scale(pb, fbuf)
    size = round(size * scale_f, 2)
```

`standin_size_scale` measures the `'x'` glyph bounds of both fonts via `BoundsPen` and returns `xheight_primary / xheight_stand_in`. For NewBaskerville → Libre Baskerville this is ≈0.88–0.92.

`MANUAL_SIZE_SCALE` is a top-level override dict (`{"librebaskerville": 0.90}`) for fine-tuning without code changes.

### 6.3 Invariants

| # | Rule | Why |
|---|------|-----|
| E1 | **No space-run coalescing.** Every run (word and space) keeps its own absolute X. | Coalescing made inter-word spacing depend on the preceding run's font metrics, which broke whenever a stand-in was in play. |
| E2 | Baselines are **never modified** by stand-in sizing. | Matching x-height at the same baseline is what makes stand-ins blend; shifting baseline would visibly misalign words. |
| E3 | `_safe_insert_font` wraps every `page.insert_font` call and logs the pre-insert canary. | Without canary logging, metric divergences (`space_advance=0`, wrong `upm`) are invisible until the screenshot. |
| E4 | Spaces are **never** routed to a stand-in. | Stand-in spaces would consume/donate inter-word budget, visibly shifting subsequent words. |
| E5 | `_emit_token` in the run-faithful path uses the same per-token verified selection. | The run-faithful path (super/subscript handling) must behave identically to the manifest fast-path. |

---

## 7. The Pre-Insert Canary (Step 2 — `pdf_edit.py`)

```python
def _log_font_canary(fontname, buf, fontsize):
    tt = TTFont(io.BytesIO(buf))
    upm = tt["head"].unitsPerEm
    space_adv = tt["hmtx"].metrics.get("space", (0, 0))[0]
    space_pt = (space_adv / upm) * fontsize if upm > 0 else 0.0
    logger.info(f"[CANARY] font={fontname!r} upm={upm} "
                f"space_advance={space_adv} space@{fontsize}pt={space_pt:.2f}")
```

**Invariant C1**: Every font buffer handed to MuPDF is canary-logged with its metrics **before** insertion. The `[CANARY]` / `[EMIT]` pair in the bake log is the diagnostic trail for any future visual regression.

---

## 8. Family Identity (`font_utils.py`)

```python
def canonical_family(name):
    """Strip emb_/F1_/g_d0_ prefixes, ABCDEF+ subset tag, style suffix,
    hyphens, underscores, spaces. Return lowercase."""

def family_match(a, b):
    """Truncation-tolerant: 'newbaskervill' vs 'newbaskerville-roman'."""
    return a == b or a.startswith(b) or b.startswith(a)
```

**Invariant I1**: All family comparisons flow through `canonical_family` + `family_match`. Raw string equality is forbidden — it breaks on every prefix, truncation, and subset tag variation.

---

## 9. The 3-Bake Gauntlet

Every change to the bake pipeline must pass:

1. **Bake 1 (pristine PDF, type a sentence with novel chars `k`, `w`, `N`):**
   - `[EMIT]` shows original runs on the original subset, typed runs on the vault full font at the scaled size.
   - Render matches the "known-good" screenshot (typed words visually blend, correct size, correct spacing).
   - `[MERGED-LINE]` text equals typed text character-for-character, spaces included.

2. **Bake 2 (re-edit the same paragraph, type another novel char):**
   - No invisible chars, no `□` boxes.
   - `[MERGED-LINE]` equals typed text.
   - `[EMIT]` fonts identical to bake 1.
   - No `FALLBACK: … -> universal` for this paragraph.

3. **Bake 3 (same as bake 2):**
   - Identical result. Silence in the promotion log (or identical target) = the generational loop is closed.

Any regression on any bake must be treated as a **critical failure** and the change reverted.

---

## 10. Anti-Patterns (Do NOT Reintroduce)

These were each the root cause of a real regression. Do not add them back under any circumstances.

| ✗ Anti-Pattern | What it caused |
|---|---|
| Paragraph-level `bad` / `resolver` / `still` routing | Bake-2 invisible chars (`Now` → `o`) |
| Whole-paragraph promotion (replacing `plan["fontname"]`) | Typed words in visibly different typeface |
| Space-run coalescing in `_emit_layout_manifest` | Glued words; stand-ins eating space budget |
| `_inject_cmap` in the bake path | Re-extraction corruption in PyMuPDF 1.26.4+ |
| Table surgery (hmtx/unitsPerEm rewrite) on valid TTF/OTF | Oversized glyphs, collapsed spacing |
| Trusting OS/2 `sxHeight` for x-height calibration | Stand-ins at wrong size (computed scale ≈ 1.0) |
| First-match scans over `manifest.json` | Italic stand-in for a roman paragraph |
| Auto-ingest writing into the full-font index | Subsets returned as promotion targets |
| Cmap-only coverage detection (no ink-probe) | `.notdef` mapped codepoints falsely reported as "present" |
| Reusing buffer by name (not by `_font_id`) | Mangled/truncated names (`emb_OPYJSL+…`) routed wrong buffers |

---

## 11. Open Cosmetic Issues

These are **acceptable known limitations**, not bugs:

1. **Stem-weight difference** on stand-in glyphs (e.g., the "L" stem in Libre Baskerville is heavier than NewBaskerville). Fixable only by registering a licensed full NewBaskerville via `ingest_system_font.py` — not by any code change.
2. **Unknown families** (no vault row) fall to the universal pymupdf-fonts fallback — visible, but different typeface. Fixable by adding the family to `fetch_fonts.py`.

Neither of these affects the gauntlet acceptance criteria.

---

## 12. Maintenance Checklist

When modifying any file in `backend/converter/`:

- [ ] `prepare_for_insert` is still used for every bake-path buffer.
- [ ] `_pick_run_font` is still per-run, not per-paragraph.
- [ ] Vault full font is still the last entry in candidates (guaranteed fallback).
- [ ] `_glyph_has_ink` is still cached.
- [ ] No table surgery on valid TTF/OTF.
- [ ] `family_map.json` / `aliases.json` still written only by harvest tools.
- [ ] 3-bake gauntlet passes.

If any checkbox fails, revert the change.

---

*End of document.*
