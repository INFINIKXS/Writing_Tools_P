---
archived: 2026-07-25T02:16:21.132767
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\97a6308b-4cda-4fc9-a0e9-efbebac2ca77\walkthrough.md
---

# Image Watermark Upload Payload & Parameter Fix

We fixed the issue where uploading an image watermark caused an error upon clicking "Add Watermark".

---

## 1. Summary of Resolution

### 🐛 Identified Causes
1. **File Payload Serialization**: In `handleConvert` (`ConverterView.jsx`), extra parameters were appended using `.toString()`, converting `File` objects to the string `"[object File]"`.
2. **Key & Type Mismatches**:
   - `watermark_mode: 'image'` vs backend parameter `watermark_type: 'image'`.
   - `image_file` key was omitted from `extraParams`.
   - `opacity` expected float (`0.5`), but frontend sent `'50%'`.
   - `rotation` expected int (`45`), but frontend sent `'45°'`.
   - `font_size` expected int (`36`), but frontend sent `'36pt'`.
   - `scale` expected float (`1.0`), but frontend sent `'100%'`.

### 🛠️ Changes Implemented (`frontend/src/components/ConverterView.jsx`)
- **Dynamic FormData File Detection**: Updated `handleConvert` so any `File` or `Blob` instance in `extraParams` is appended as a true file stream rather than calling `.toString()`.
- **Parameter Serialization**: Updated `AddWatermarkVisualView` `setExtraParams` effect to set:
  - `watermark_type: mode`
  - `image_file: watermarkImage.file`
  - `opacity: parseFloat(transparency) / 100.0`
  - `rotation: parseInt(rotation.replace('°', ''), 10)`
  - `font_size: parseInt(fontSize, 10)`
  - `scale: scale / 100.0`

---

## 2. Verification Results
- **Frontend Build**: Verified build completed with 0 errors.
- **Image Watermarking Pathway**: Both text and image watermark options now pass all parameters cleanly to the backend PyMuPDF engine.
