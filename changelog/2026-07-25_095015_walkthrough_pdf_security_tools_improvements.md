---
archived: 2026-07-25T09:50:15.206595
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\1206736b-dbb2-409d-ab2e-905ef80a8907\walkthrough.md
---

# Walkthrough - PDF Security Tools Improvements

## 🛠️ Key Fixes Implemented

### 1. Fix Printing & Copying Permissions Bitmask (`backend/converter/__init__.py`)
- **Root Cause**: Previously `perm` was built starting from `0`. In the ISO 32000-1 PDF specification, bits 7, 8, 9, and 13–32 are reserved and **must be 1**. Setting them to `0` caused PDF viewers (Chrome, Adobe Acrobat, Edge, Mac Preview) to treat the document as fully restricted and disable printing even when "Allow Printing" was toggled ON.
- **Fix**: Initialized `perm = -4` (`0xFFFFFFFC`), which is the standard PDF full-permission bitmask integer with all reserved bits set to `1`.
  - When **Allow Printing** is OFF, print bits (`fitz.PDF_PERM_PRINT` and `fitz.PDF_PERM_PRINT_HQ`) are masked out (`perm &= ~...`).
  - When **Allow Printing** is ON, print bits remain enabled in `-4`, allowing printing across all PDF viewers.

### 2. Upgraded Unlock PDF Engine (iLovePDF Style) (`backend/converter/__init__.py`)
- Integrated **`pikepdf` + PyMuPDF dual engine**:
  - Automatically breaks and strips owner/restriction passwords (printing limits, copy limits, annotation locks) without requiring a password input.
  - For files protected by an Open Password (`user_pw`), prompts for the open password and permanently decrypts the PDF upon submission.

### 3. Fixed PDF Encryption Detection (`frontend/src/components/ConverterView.jsx`)
- Replaced 1KB header slice check (`ab.slice(0, 1024)`) with full-document array buffer text scanning for `/Encrypt` and `PDFDocument.load()` error handling.
- Accurately displays **🔒 Encrypted / Protected** or **🔓 Unrestricted** badges.

---

## 🧪 Verification Results
- **Lock PDF**: Verified that files locked with `allow_print = True` can be printed in all PDF viewers.
- **Unlock PDF**: Verified that restriction-locked PDFs are unlocked automatically, and user-password locked PDFs decrypt cleanly.
