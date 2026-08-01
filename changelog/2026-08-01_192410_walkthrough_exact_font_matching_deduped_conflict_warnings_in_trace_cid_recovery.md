---
archived: 2026-08-01T19:24:10.581933
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Exact Font Matching & Deduped Conflict Warnings in Trace CID Recovery

Fixed cross-font contamination during trace CID recovery in [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py).

## Problem & Motivation

The previous substring matching condition (`target_short in span_font or span_font in target_short`) caused closely-named sibling fonts (such as `HelveticaNeueLTStd-BdCn` and `HelveticaNeueLTStd-Cn`) to match each other's text trace spans, accidentally polluting GID mappings across distinct font files. Additionally, conflict warning logs were spamming stdout on every character occurrence.

## Changes Made

### Backend Font Pipeline ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

1. **Exact Font Name Equality (`target_short == span_font`)**:
   - Replaced substring matching with strict exact string equality (`if target_short == span_font:`).
   - Ensures trace recovery only collects GID mappings from text trace spans rendered in that exact font.

2. **Deduplicated Conflict Warning Logging**:
   - Introduced `_warned_conflicts = set()` tracking `(ucp, first_gid, conflicting_gid)` tuples.
   - Logs each unique cross-page GID conflict warning exactly once instead of repeating on every character match.
