---
archived: 2026-08-01T10:18:19.007383
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Removal of Unsafe Identity GID Fallback in `_inject_cmap`

Replaced dangerous `gid = cid` (identity fallback guess) in [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py) with explicit warning logging and unmapped skipping.

## Problem & Root Cause

In subsetted PDF fonts, glyph indices bear no relationship to character codes. The previous `else: gid = cid` fallback resulted in wrong-but-valid character substitutions (e.g. `9` rendering as `j` and `%` rendering as `J`) whenever a codepoint was missing from `cid_to_gid`, `unicode_to_gid`, and `font_cmap_gids`.

## Changes Made

### Backend Font Pipeline ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

1. **Replaced Identity Guessing with Explicit Unmapped Skipping**:
   ```python
   if cid in cid_to_gid:
       gid = cid_to_gid[cid]
   elif ucp in unicode_to_gid:
       gid = unicode_to_gid[ucp]
   elif ucp in font_cmap_gids:
       gid = font_cmap_gids[ucp]
   else:
       logger.warning(f"No reliable GID for U+{ucp:04X} ({uchar!r}) — leaving unmapped rather than guessing.")
       continue
   ```

2. **Expanded Diagnostic Inspection (`_SUSPECT_CHARS`)**:
   Added `9` (`0x39`) and `%` (`0x25`) to the suspect character diagnostic audit log:
   ```python
   _SUSPECT_CHARS = {
       'f': 0x66, 'l': 0x6C, 'k': 0x6B, 'i': 0x69, ' ': 0x20,
       '9': 0x39, '%': 0x25
   }
   ```
