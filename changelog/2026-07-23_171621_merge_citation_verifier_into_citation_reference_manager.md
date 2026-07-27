---
archived: 2026-07-23T17:16:21.191433
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\8bb50279-fc75-4a19-a4cc-2f021dc51f7b\walkthrough.md
---

# Merge Citation Verifier into Citation & Reference Manager

Consolidated the standalone **Citation Verifier** module into the unified **Citation & Reference Manager** hub, reducing the Orbital Ring from 6 to 5 distinct modules.

---

## Changes Made

### `features.js`
- Removed standalone `id: 1` (Citation Verifier) entry from `featureTimelineData`
- Renamed `id: 3` from **Reference Library** → **Citation & Reference Manager**
- Updated description: *"Extract citations from documents, verify reference lists against academic databases, and format bibliographies in any style."*
- Swapped icon from `BookOpen` → `Bookmark` (more fitting for a manager)
- Removed unused `CheckCircle` and `Pencil` imports; replaced with `Bookmark`

### `App.jsx`
- Removed `{ id: 'verifier', ... }` from `NAV_ITEMS`
- Removed `{ id: 'verifier', component: <VerifierView /> }` from `PERSISTENT_VIEWS`
- Removed `import VerifierView` (no longer needed)
- Updated library label to `Citation & Reference Manager`
- Updated converter label to `PDF/File Conversion Tools`

### `Footer.jsx`
- Replaced two separate footer links (Citation Verifier + Reference Library) with a single **Citation & Reference Manager** link pointing to the `library` view

### `LibraryView.jsx`
- Updated `<h1>` from **Reference Library** → **Citation & Reference Manager**
- Updated subtitle to reflect all 3 capabilities: extraction, verification, and formatting

---

## Verification

- `npm run build` → ✅ **2481 modules, 0 errors** (down from 2482; ~35KB bundle reduction)
- Internal `verifier` sub-tab references in LibraryView remain correct (those are sub-navigation, not top-level routes)
