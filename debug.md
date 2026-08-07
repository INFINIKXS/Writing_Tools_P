# Backend Debug Logging Guide

To enable debug-level logging in the backend (including typography extraction, region classification `[RECTS]`/`[GROUP]`/`[REGION]`, and block healing `[HEAL]` diagnostic traces), run the backend server with `EDITOR_LOG_LEVEL=DEBUG`.

## PowerShell (Windows)

Run the following command from the `backend` directory:

```powershell
$env:EDITOR_LOG_LEVEL="DEBUG"; uvicorn main:app --reload
```

Or from the project root (`Writing_Tools_Production`):

```powershell
$env:EDITOR_LOG_LEVEL="DEBUG"; python -m uvicorn backend.main:app --reload
```

---

## What You Will See in the Logs

When `EDITOR_LOG_LEVEL=DEBUG` is set, every PDF page spacing extraction will emit detailed diagnostic lines:

- `[RECTS]`: Enclosing drawing/image rect coordinates extracted from PyMuPDF.
- `[GROUP]`: Count of rect-assigned text lines vs free text lines.
- `[REGION]`: Kind (`rect`/`gap`/`line`), column index, y-extents, and line text preview.
- `[HEAL]`: Block pair evaluation results (`MERGE` or exact rejection reason such as `kind_mismatch`, `vertical_overlap`, `v_gap_too_large`, `font_size`, `font_family`, `h_overlap`, `left_edge`).
