---
archived: 2026-08-05T20:40:00.498820
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\aac18b6b-9e63-4aab-aa46-d18cb5d2ff37\walkthrough.md
---

# Phase 1 Walkthrough — Store Loop Guard & Infinite Render Prevention

## Summary of Accomplishments

### Store & Editor Architecture Refactoring (`activeEditorStore.js`, `CanvasInlineEditor.jsx`, `Viewer.jsx`)

Implemented strict no-op guards and push-based snapshots across `activeEditorStore` and `CanvasInlineEditor` to deterministically prevent React infinite update-loop crashes (`Maximum update depth exceeded`) during paragraph switches (A → B → A):

1. **Strict Equality Guards in `stores/activeEditorStore.js`**
   - Added equality check to `setActiveEditor(key)` (`if (activeKey === key) return;`) so re-asserting the active key is a no-op.
   - Added `isNew` guard to `registerEditor(key, apiRef)` to emit only on new mounts.
   - Added deletion check to `unregisterEditor(key)` to emit only when an actual editor key is removed.

2. **Push-Based Snapshots & Cached References**
   - Implemented `pushState(key, state)` with `shallowEqual(prev, state)` to maintain stable snapshot object identities in `toolbarState`.
   - Updated `getSnapshot` to return a cached reference `(activeKey && toolbarState.get(activeKey)) || null` instead of constructing fresh object literals on every call.
   - Updated `getActiveEditor` and `getEditorApi` to resolve from a stable `apiRef.current`.

3. **Single Registration per `editKey` in `CanvasInlineEditor.jsx`**
   - Stored editor callbacks in `apiRef = useRef()` and registered `registerEditor(editKey, apiRef)` with dependency `[editKey]` only.
   - Pushed formatting state changes using `pushState` inside a dedicated `useEffect` observing formatting values.

4. **Idempotent Activation in `Viewer.jsx`**
   - Guarded `setActiveEditKey(prev => (prev === key ? prev : key))` to avoid triggering redundant React component re-renders during paragraph switches.
