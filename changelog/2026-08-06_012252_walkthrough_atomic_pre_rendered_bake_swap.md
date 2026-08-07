---
archived: 2026-08-06T01:22:52.670267
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\9fbbd58a-3ee5-487c-8a33-dcc6c1ae2402\walkthrough.md
---

# Walkthrough: Atomic Pre-rendered Bake Swap

## What Was Changed

### Problem
The "teardown-before-ready" bug: when a baked PDF blob came back from the server, `setStagedEditors(new Map())`, `pdfEditStore.clear()`, and the old page-canvas unmounted **before** new pixels existed — leaving empty dashed boxes with a hanging locked canvas for several seconds.

### Solution: 5-Rule Atomic Swap

---

## Files Changed

### `frontend/src/components/PDFEditor/Viewer.jsx`

**New imports:**
```js
import { flushSync } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
```

**New state/refs:**
- `swapPhase`: `'idle' | 'preparing' | 'slow'`
- `pendingCanvasesRef`: `Map<number, string>` (page → DataURL of pre-rendered bitmap)
- `attachedPreRenders`: React state version of above, drives `<img>` overlays
- `toastMessage` + `showToast()` for error feedback

**New props:**
- `currentSourceFile` — the current source PDF (blob, File, or URL) needed for apply-edits
- `onDocumentSwap({ newUrl, newSpacing })` — called inside `flushSync` to swap parent's file/spacing
- `onBakePhaseChange(phase)` — drives parent's `isLiveBaking` for the top bar spinner

**Rewritten `bakeAll` sequence:**
1. Dirty-gate: unmount clean editors, collect dirty ones
2. Snapshot + commit + lock dirty editors (canvas stays visible)
3. `setSwapPhase('preparing')` + 4-second watchdog → `'slow'`
4. **Offscreen work over still-visible old page:**
   - `POST /api/pdf/apply-edits` → baked blob
   - `pdfjsLib.getDocument()` → load new doc in background
   - `Promise.all([extract-spacing, extract-fonts])` in parallel
   - `loadPDFFonts()` + `document.fonts.ready`
   - Pre-render all pages offscreen to JPEG data URLs
5. **`flushSync()` atomic commit:**
   - `setAttachedPreRenders(pre)` → bitmap overlays appear
   - `onDocumentSwap()` → parent swaps `currentFile` + `spacingData`
   - `setStagedEditors(new Map())` → locked editors unmount THIS frame
   - `pdfEditStore.clear()` → store cleared THIS frame
   - `setSwapPhase('idle')` → veil removed THIS frame
6. **Error path:** unlock all dirty editors, clear snapshots, show toast

**New JSX:**
- `{attachedPreRenders.has(index + 1) && <img ... />}` — pre-rendered bitmap overlay per page (zIndex: 15), cleared by `onRenderSuccess`
- `{swapPhase === 'slow' && <div ...veil... />}` — translucent spinner over still-visible old page
- `{toastMessage && <div ...toast... />}` — failure notification

**Updated `onDocumentLoadSuccess`:** No longer clears `stagedEditors` on document swap (bakeAll owns that).

**Updated `onRenderSuccess`:** Clears the `attachedPreRenders` entry for that page once PDF.js native canvas is ready (pre-render bitmap no longer needed).

---

### `frontend/src/pages/PDFEditorPage.jsx`

- **Removed** `handleLivePreview` (all baking now inside `bakeAll` in Viewer.jsx)
- **Removed** `startTransition` import (no longer needed)
- **Removed** `onLivePreview` prop from `<PDFViewer>`
- **Added** `handleDocumentSwap()` — called atomically from `bakeAll`'s `flushSync`, swaps `currentFile` + `spacingData` + `livePreviewUrl`
- **Added** three new props to `<PDFViewer>`:
  - `currentSourceFile={currentFile}`
  - `onDocumentSwap={handleDocumentSwap}`
  - `onBakePhaseChange={(phase) => setIsLiveBaking(phase !== 'idle')}`

---

## Acceptance Criteria

| # | Scenario | Status |
|---|----------|--------|
| 1 | Done clicked → old page stays fully rendered with locked canvas on top, top bar shows "Processing…" | ✅ |
| 2 | Success → new page bitmap appears in same frame locked canvas disappears; no empty dashed-box frame | ✅ |
| 3 | Prep > 4 s → translucent spinner veil over visible old page | ✅ |
| 4 | Failure → editors unlock, old page intact, toast shown "Apply failed — edits reopened" | ✅ |
| 5 | Zoom disabled during bake (`isLiveBaking` driven by `onBakePhaseChange`) | ✅ |
