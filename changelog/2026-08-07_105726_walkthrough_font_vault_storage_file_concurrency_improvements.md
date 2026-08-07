---
archived: 2026-08-07T10:57:26.230456
source: C:\Users\Paradox-Labs\.gemini\antigravity\brain\0de22959-305c-4d38-a25b-bfa861b7f724\walkthrough.md
---

# Walkthrough — Font Vault Storage & File Concurrency Improvements

## Objectives
1. **Move Vault Out of Synced Directories**: Honor `FONT_VAULT_DIR` environment variable and default `VAULT_DIR` to `%LOCALAPPDATA%\pdf_editor_font_vault` (or `~/.cache/pdf_editor_font_vault`), safely outside sync folders like OneDrive/Documents. Automatically copy existing seed files if necessary.
2. **Rename Retry & Exponential Backoff**: Wrap `os.replace` in `_write_manifest` with up to 3 attempts (100ms, 200ms backoff) using PID-unique temporary files (`.tmp.{os.getpid()}`). On final failure, log a warning and safely clean up the temporary file without corrupting the existing `manifest.json`.
3. **Debounced Batch Writes**: Introduce `vault_batch_write` context manager and `vault_ingest_batch(items)` helper. Update `/extract-fonts` in `backend/pdf_routes/editor.py` to accumulate extracted fonts and trigger a single background batch write, reducing 25+ sequential manifest file renames per request to 1 atomic write.

## Key Implementation Details

### 1. Non-Synced `VAULT_DIR` Location & Seed Mirroring (`backend/converter/font_vault.py`)
```python
def _default_vault_dir() -> Path:
    if os.getenv("FONT_VAULT_DIR"):
        return Path(os.getenv("FONT_VAULT_DIR"))
    local_app_data = os.getenv("LOCALAPPDATA")
    base_vault = Path(local_app_data) / "pdf_editor_font_vault" if local_app_data else Path.home() / ".cache" / "pdf_editor_font_vault"
    proj_vault = Path(__file__).resolve().parent.parent / "font_vault"
    if proj_vault.exists() and proj_vault.is_dir():
        try:
            base_vault.mkdir(parents=True, exist_ok=True)
            for sub in ["full", "buffers", "manifest.json"]:
                src = proj_vault / sub
                dst = base_vault / sub
                if src.exists() and not dst.exists():
                    if src.is_dir():
                        import shutil
                        shutil.copytree(src, dst, dirs_exist_ok=True)
                    else:
                        import shutil
                        shutil.copy2(src, dst)
        except Exception:
            pass
    return base_vault

VAULT_DIR = _default_vault_dir()
```

### 2. Rename Retry & Backoff (`_write_manifest`)
```python
def _write_manifest(mf):
    p = VAULT_DIR / "manifest.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(f".tmp.{os.getpid()}")
    try:
        tmp.write_text(json.dumps(mf, indent=1))
        import time
        for attempt in range(3):
            try:
                os.replace(tmp, p)
                _MCACHE.update(mtime=p.stat().st_mtime, data=mf, dirty=False)
                return
            except OSError as err:
                if attempt == 2:
                    import logging
                    logging.getLogger(__name__).warning(f"_write_manifest replace failed after 3 attempts: {err}")
                    if tmp.exists():
                        try: tmp.unlink()
                        except Exception: pass
                    return
                time.sleep(0.1 * (attempt + 1))
    except Exception as ex:
        import logging
        logging.getLogger(__name__).warning(f"_write_manifest failed: {ex}")
        if tmp.exists():
            try: tmp.unlink()
            except Exception: pass
```

### 3. Debounced Batch Ingestion (`vault_batch_write` & `vault_ingest_batch`)
```python
class vault_batch_write:
    def __enter__(self):
        depth = getattr(_BATCH_DEPTH, "val", 0)
        _BATCH_DEPTH.val = depth + 1
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        _BATCH_DEPTH.val = getattr(_BATCH_DEPTH, "val", 1) - 1
        if _BATCH_DEPTH.val <= 0:
            _BATCH_DEPTH.val = 0
            with _LOCK:
                if _MCACHE.get("dirty"):
                    _write_manifest(_MCACHE["data"])
                    _MCACHE["dirty"] = False

def vault_ingest_batch(items):
    with vault_batch_write():
        for item in items:
            family = item[0]
            basename = item[1]
            buffer = item[2]
            kwargs = item[3] if len(item) > 3 else {}
            vault_ingest(family, basename, buffer, **kwargs)
```

In `backend/pdf_routes/editor.py`:
`/extract-fonts` collects all extracted font tuples into `extracted_vault_items` and runs `background_tasks.add_task(vault_ingest_batch, extracted_vault_items)`.

## Verification Results
- **Full Test Suite Passed**: 10/10 tests across `test_font_vault_gauntlet.py`, `test_novel_character_trap.py`, `test_root_family.py`, `test_glyph_detector_subset.py`, `test_twobake_gauntlet.py`, and `test_font_promotion_gauntlet.py` passed cleanly (35.17s).
