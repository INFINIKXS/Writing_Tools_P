---
archived: 2026-07-25T10:55:46.574940
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\1206736b-dbb2-409d-ab2e-905ef80a8907\walkthrough.md
---

# Walkthrough - Lock PDF First-Click Parameter Timing Fix

## 🛠️ Root Cause & Fix

### 🐛 The Issue
When clicking "Protect PDF" or "Unlock PDF" for the first time, an error banner `Field required` would appear. However, clicking the submit button a second time would succeed.

### 🔍 Root Cause
`LockPdfVisualView` and `UnlockPdfVisualView` were previously calling `setExtraParams(params)` (an asynchronous React state updater) and immediately calling `onConvert()` synchronously on the next line. Because React state updates are asynchronous, `extraParams` was still empty `{}` during the initial `onConvert()` execution, causing the backend API to receive a request missing the `password` field (`422 Field required`).

### ⚡ The Fix (`frontend/src/components/ConverterView.jsx`)
Updated `handleSubmit` in `LockPdfVisualView` and `UnlockPdfVisualView` to pass the `params` object **directly** as an explicit argument to `onConvert(null, params)`. This bypasses React's asynchronous state update lag and guarantees the backend receives the password and parameters on the very first click!
