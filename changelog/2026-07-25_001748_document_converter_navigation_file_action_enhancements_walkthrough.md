---
archived: 2026-07-25T00:17:48.810167
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\4b6461cd-d87a-426b-9121-d64c40307769\walkthrough.md
---

# Document Converter Navigation & File Action Enhancements Walkthrough

We updated [`frontend/src/components/ConverterView.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/ConverterView.jsx) to support file additions, file replacements, and seamless return navigation to completed download results.

---

## 1. Summary of Changes

### A. Dual File Actions: "+ Add File" & "↑ Change File"
- **"Add File" Button (`+ Add file`)**: Allows users to append additional files to the selected document queue at any point.
- **"Change File" Button (`↑ Change file`)**: Replaces the current file in the queue with a newly selected file.
- **"Clear" Button (`🗑 Clear`)**: Resets the selection and returns to the initial dropzone.

### B. "Return to Download Screen" Navigation
- **Preserved Result Memory**: Going back to adjust options or modify files no longer discards the previously generated result file (`resultBlob`).
- **Top Ready Banner**: When a previously completed output exists, a top banner alerts the user:
  `Previous Conversion Ready: APRIL ROASTER.xlsx (37.2 KB)`
  with immediate `[ Download File ]` and `[ Back to Download Screen ]` options.
- **Primary Action Companion Button**: A secondary button appears directly beneath the primary conversion action:
  `Return to Download Screen (APRIL ROASTER.xlsx)`
  allowing the user to return to the download screen instantly without re-running the conversion.

---

### C. Extract Pages vs. Remove Pages Contextual Terminology & Styling
- **Dynamic Contextual Terminology**: When using the `Extract Pages` tool (`tool.id === 'extract-pages'`), all UI headers, guidance banners, summary metrics, and button labels automatically switch from "removal" terminology to accurate "extraction" terminology:
  - Header: `SELECT PAGES TO EXTRACT`
  - Guidance Banner: `Page Extraction Guidance` ("Click on pages to extract into a new PDF document...")
  - Summary Counters: `Extracted` and `Unselected` (instead of `Removed` and `Remaining`)
  - Input Label: `Pages to extract`
  - Badges & Card Overlays: `Extracted` / `Marked for Extraction`
  - Thumbnail & Modal Action Tooltips: `Extract Page` / `Deselect Page`
- **Contextual Color Palettes**: `Extract Pages` utilizes an emerald theme (`emerald-500` borders, green checkmarks `<CheckCircle2 />`) while `Remove Pages` preserves the red deletion theme (`red-500` borders, `<X />` and `<Trash2 />` icons).

---

### D. Interactive Per-Page PDF Rotation (`RotatePdfVisualView`)
- **Interactive Thumbnail Cards**: Every page of the uploaded PDF is rendered visually using `pdfjs-dist`.
- **Independent Page Controls**: Each page thumbnail card features controls to rotate left ↺ (-90°), rotate right ↻ (+90°), or reset (0°).
- **Real-Time Visual Spin**: Thumbnails animate smoothly on screen using CSS `transform: rotate(${angle}deg)` with live angle badges (e.g., `90° ↻`).
- **Quick Action Toolbar**: `Rotate All Left ↺ 90°`, `Rotate All Right ↻ 90°`, and `Reset All 0°`.
- **Backend Per-Page Mapping**: Serializes per-page rotations map (`{"1": 90, "2": 180}`) into `extraParams.rotations` and passes it to `POST /api/convert/rotate-pdf`.

### E. Add Page Numbers Redirection & Direction Pointer
- **Automatic Redirection**: Clicking `Add Page Numbers` (`add-page-numbers`) automatically routes the user to `Organize PDF` (`organize-pdf`).
- **Glowing Direction Pointer Banner**: Displays a prominent callout banner: *"📍 Direction: Add Page Numbers to PDF - Organize your document pages on the left, then use the 'Page Numbering Overlay' options below to customize position, format, and numbers."*
- **Reference & Icon Fixes**: Resolved `focusedFeature` prop definition and imported `Sparkles` icon from `lucide-react` across [`frontend/src/components/ConverterView.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/ConverterView.jsx).

### F. PDF to PDF/A Upgrades (`pdf-to-pdfa`)
- **Options Panel**: Conformance level dropdown selector (`PDF/A-2b` recommended, `PDF/A-1b` legacy, `PDF/A-3b` XML & file attachments).
- **Downgrade Checkbox**: Toggle `Allow Downgrade of PDF/A Compliance Level` for automatic fallback.
- **ISO 32000-1 Information Box**: Informational card detailing digital preservation standards.

### G. OCR Transcriber Module (`ocr-to-word`)
- **Right-Side Navigation Category**: Positioned **OCR & Transcriber** at the right-most end (4th column) of the section grid layout in [`frontend/src/components/ConverterView.jsx`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/frontend/src/components/ConverterView.jsx).
- **Scanned Payslips & Images OCR Reconstruction**: Enhanced `_run_ocr_to_word_sync` in [`backend/converter/__init__.py`](file:///c:/Users/Paradox-Labs/Documents/Projects/Writing_Tools_Production/backend/converter/__init__.py):
  1. **Top Logo & Header Crop**: Detects top header graphic contours and automatically extracts/inserts company logos into Word (`doc.add_picture(logo_file)`).
  2. **Table Grid Cell Detection**: Uses OpenCV morphological line detection (`cv2.morphologyEx`) to find horizontal/vertical table border lines. Clusters cell bounding boxes into matrix rows/columns, runs Tesseract OCR per cell (`--psm 6`), and populates native Word table grid cells (`tbl.style = 'Table Grid'`).
  3. **Bottom Signatures & Seals**: Detects bottom signature/stamp regions and embeds cropped signature graphics directly into the Word document footer.
- **Multi-Language Support**: English, Spanish, French, German, Italian, Portuguese.

### I. Concurrent Multi-Task Background Conversion Manager & Floating Tasks Drawer
- **Global Background Jobs Registry (`bgJobs`)**: Initiating any conversion job creates an independent background job object in `bgJobs`. Tasks run asynchronously with background XHR uploads and status polling (`/api/jobs/${id}/status`).
- **Persistent Non-Blocking Navigation**: Users can navigate between tools, switch modules, or return to the main dashboard while active conversions run in parallel.
- **Floating Tasks Drawer (`BackgroundTasksDrawer`)**:
  - Rendered fixed at the bottom-right of the viewport (`fixed bottom-6 right-6 z-50`).
  - **Collapsed Pill Badge**: Displays live counters (`⚡ 2 Processing`, `✅ 1 Ready`).
  - **Expanded Drawer View**: Displays job cards with tool icons, file names, live progress bars, upload speed/ETA, and elapsed time.
  - **Action Controls**:
    - **`[ 📥 Download ]`**: Instantly downloads completed conversion files directly from the drawer.
    - **`[ 🔍 Open Task ]`**: Switches tool view to display that task's output screen.
    - **`[ ❌ Cancel / Dismiss ]`**: Cancels active upload/backend task (`/api/jobs/${id}/cancel`) and cleans up state.

---

## 2. Verification Results

### Automated Backend E2E Tests
```text
--- Running Backend Automated Verification E2E Tests ---
Testing Per-Page PDF Rotation...
  [SUCCESS] Per-page PDF rotation verified successfully!
Testing PDF to Markdown Conversion...
  [SUCCESS] PDF to Markdown conversion verified successfully!
Testing OCR to Word Document Conversion...
  [SUCCESS] OCR to Word conversion verified successfully!
--- ALL BACKEND E2E TESTS PASSED ---
```


