---
archived: 2026-07-24T11:59:25.939324
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\917a5a31-4816-4df7-a2f3-5ba3f4593fc5\walkthrough.md
---

# Walkthrough — Fix for TypeError Reading Quality in Image Compressor

We identified and resolved the exact root cause of the `TypeError: Cannot read properties of undefined (reading 'quality')` error when selecting files in the Image Compressor tool.

## Root Cause Analysis
In [`frontend/src/components/ConverterView.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/ConverterView.jsx), the `FileDropZone` component destructures `extraParams` and `setExtraParams` props:

```jsx
function FileDropZone({
  tool, files, setFiles, ..., extraParams, setExtraParams
})
```

When rendering tool parameters for the **Compress Image** tool (such as `quality`, `target_format`, `max_dim`), `FileDropZone` attempted to access `extraParams[param.key]`. 

However, at the call site inside `ConverterView` (line 1418), `<FileDropZone>` was rendered **without passing `extraParams` or `setExtraParams` as props**:

```jsx
// BEFORE (Missing props)
<FileDropZone
  tool={selectedTool}
  files={files}
  ...
  uploadMetrics={uploadMetrics}
  // extraParams and setExtraParams were omitted!
/>
```

Because `extraParams` was `undefined`, evaluating `extraParams['quality']` threw an immediate JavaScript error: `TypeError: Cannot read properties of undefined (reading 'quality')`.

## Fix Applied
1. **Passed Props to `<FileDropZone>`**: Added `extraParams={extraParams}` and `setExtraParams={setExtraParams}` to the `<FileDropZone>` invocation in `ConverterView.jsx`.
2. **Defensive Defaults**: Added default fallback values `extraParams = {}, setExtraParams = () => {}` in the `FileDropZone` function signature.

---

## Verification
- Verified prop passing and default state fallback in `frontend/src/components/ConverterView.jsx`.
- Verified clean build and execution.
