---
archived: 2026-08-05T22:08:45.326216
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Walkthrough — Immutability of Staged Editors Until Document Swap

We have closed the mid-bake reset and disappearance window so that staged editor canvas content remains completely immutable from external state until the new baked PDF visually replaces it:

1. **Gated Re-initialization with `stagedRef` (`CanvasInlineEditor.jsx`)**
   - Added `stagedRef = useRef(false)`, which flips to `true` the moment an editor is modified or locked.
   - Parsed initial character metadata (`parseCharMetadata`) ONCE at mount into `initialParsedRef`. Re-renders from prop updates (`item`, `existingEdit`) no longer re-initialize `charMetaRef` or text state.
   - Added `console.count('charMeta init')` in dev mode for auditing: after pressing `Done`, the `charMeta init` count remains unchanged.

2. **Captured Snapshot Item Rendering (`Viewer.jsx`)**
   - In `Viewer.jsx`, staged editors are rendered directly from the captured `item` snapshot stored in the `stagedEditors` Map at click time (`stagedEditors.get(key)`).
   - Mid-bake re-analysis or spacing extractions cannot touch or re-derive staged editor items.
   - Stable `key={editKey}` props ensure React reuses the exact same mounted `CanvasInlineEditor` instances throughout the bake lifecycle.

3. **Atomic Success-Path Transition (`PDFEditorPage.jsx`)**
   - Restructured `handleLivePreview` so that `extract-spacing` is requested offscreen against the resulting PDF `blob` BEFORE any React state is cleared or updated.
   - Used `React.startTransition()` to perform document URL swap, spacing data update, typography data update, and `pdfEditStore.clear()` in a single atomic commit.
   - Eliminates the previous disappearance window where the viewer rendered the old PDF with cleared edits and un-analyzed text while waiting for the network response.

---

### Acceptance Checklist
- [x] **Edit + Done**: Added text stays visible on the locked canvas for the entire Processing... duration; `charMeta init` count does not increase after Done.
- [x] **Atomic Frame Change**: Dual-document transition is single-frame (old locked canvas -> baked PDF with no unedited flash in between).
- [x] **Bake Failure**: Dirty editors unlock with edits fully intact for corrections.
