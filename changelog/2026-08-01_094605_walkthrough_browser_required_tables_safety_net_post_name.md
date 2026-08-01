---
archived: 2026-08-01T09:46:05.859798
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\e1ceb432-c79e-4503-be99-be3186c50b34\walkthrough.md
---

# Walkthrough - Browser Required Tables Safety Net (`post` & `name`)

Added an idempotent `_ensure_browser_required_tables(tt)` helper function in [`backend/converter/font_utils.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py) to patch missing `post` and `name` tables on embedded font subsets (especially raw TrueType fonts such as `ArialMT`) prior to serving them to the browser.

## Changes Made

### 1. Missing-Table Safety Net Helper ([font_utils.py](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/font_utils.py))

```python
def _ensure_browser_required_tables(tt: TTFont):
    """
    PDF-embedded font subsets (especially raw TrueType, which skips the
    CFF->OTF wrapping path entirely) often omit tables that PDF rendering
    doesn't need but browser font sanitizers require. Patch in minimal
    versions of anything missing, idempotently — safe to call on any font.
    """
    from fontTools.ttLib import newTable

    if 'post' not in tt:
        post = newTable('post')
        post.formatType = 3.0  # no glyph names stored — valid & minimal
        post.italicAngle = 0
        post.underlinePosition = -75
        post.underlineThickness = 50
        post.isFixedPitch = 0
        post.minMemType42 = post.maxMemType42 = 0
        post.minMemType1 = post.maxMemType1 = 0
        tt['post'] = post

    if 'name' not in tt:
        name = newTable('name')
        name.names = []
        tt['name'] = name
```

### 2. Universal Invocation in `_inject_cmap`
Added `_ensure_browser_required_tables(tt)` immediately prior to `tt.save(out)` across both execution paths:
- `if skip_cmap:` (hmtx-only export path)
- Full `cmap` injection path (browser preview path)
