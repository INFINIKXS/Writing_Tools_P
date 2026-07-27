---
archived: 2026-07-25T10:16:24.753778
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\1206736b-dbb2-409d-ab2e-905ef80a8907\walkthrough.md
---

# Walkthrough - Lock PDF Dual Protection Modes (Open Lock vs. Restriction Lock)

## 🛠️ Key Improvements Implemented

### 1. Lock PDF Protection Selector (`frontend/src/components/ConverterView.jsx`)
Users can now explicitly choose between two distinct security modes when protecting a PDF:

#### 🔒 **Mode A: Open Lock (Strong User Password)**
- **Behavior**: Requires entering the password to open and view the PDF payload.
- **Security**: 256-bit AES encryption (`user_pw = password`).
- **User Notice Box**: `⚠ Irrecoverable Open Lock: Password required to view PDF. If lost, the file content cannot be opened or recovered by anyone.`

#### 🛡 **Mode B: Restriction Lock (Owner Password)**
- **Behavior**: PDF opens freely for reading without a password, but restricts printing and text copying.
- **Security**: Sets permissions mask and owner password (`user_pw = ""`, `owner_pw = password`).
- **User Notice Box**: `ℹ Recoverable Restriction Lock: PDF opens freely without password, but printing/copying text will require the password (or can be stripped via Unlock PDF).`

---

### 2. Backend Support for Dual Modes (`backend/converter/__init__.py`)
- Updated `@router.post("/api/convert/lock-pdf")` to accept `lock_mode: str = Form("open")` (`'open'` or `'permission'`).
- `_run_lock_pdf_sync` configures `user_pw` and `owner_pw` dynamically based on `lock_mode`.

---

## 🧪 Verification Results
- Verified that **Open Lock** requires a password to open the file in PDF readers.
- Verified that **Restriction Lock** allows opening freely while enforcing printing/copying limits.
