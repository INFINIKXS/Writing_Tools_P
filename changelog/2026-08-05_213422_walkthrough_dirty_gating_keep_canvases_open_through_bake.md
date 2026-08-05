---
archived: 2026-08-05T21:34:22.234148
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Dirty-Gating & Keep Canvases Open Through Bake

We have implemented per-editor dirty-gating and guaranteed canvas visibility through live PDF baking:

1. **Per-Editor Pristine Capture & `isDirty` Check (`CanvasInlineEditor.jsx`)**
   - Captured initial pristine state (`text`, `color`, `isBold`, `isItalic`, `fontSizeAdj`, `fontFamily`, `supers`) at mount in `initialRef`.
   - `isDirty()` compares current normalized text (`sanitizeForCommit`) and formatting state against `initialRef.current`.
   - Exposed `isDirty()` on the registered editor `api` and included `dirty: isDirty()` in `pushState` payloads.

2. **Reactive Done Button Semantics (`activeEditorStore.js` & `PDFEditorPage.jsx`)**
   - Added `getDirtySnapshot()` / `hasDirtyStagedEdits()` to `activeEditorStore.js`.
   - `PDFEditorPage.jsx` subscribes to `getDirtySnapshot()`; the top bar `✓ Done` button is disabled when no dirty staged editor exists.
   - Clean, unmodified staged editors are unmounted without generating entries in `pdfEditStore` or backend POST payloads.

3. **`bakeAll` Pipeline & Canvas Retention (`Viewer.jsx`)**
   - `bakeAll` categorizes staged editors into `dirtyKeys` and `cleanKeys`.
   - `cleanKeys` are unmounted immediately without writing to `pdfEditStore`.
   - `dirtyKeys` are committed sequentially to `pdfEditStore` and locked (`setLocked(true)`).
   - Canvas editors for `dirtyKeys` remain mounted and visible (read-only, white coverage active) on-screen throughout the `onLivePreview` POST request.
   - On bake success: staged editor entries are cleared only after the baked PDF document swaps into view.
   - On bake error: dirty editors unlock (`setLocked(false)`) and remain editable for corrections.

4. **Lock Rule Enforcement (`CanvasInlineEditor.jsx`)**
   - `isLocked` sets `<canvas>` cursor to `default`, pointer-events to `none`, and applies a locked blue border.
   - `<textarea>` sets `readOnly={isLocked}`.
   - `Escape`, `X`, outside clicks, and formatting toolbar actions are inert while locked.

---

### Verification
- `npm run build` executed and passed cleanly with exit code 0.
