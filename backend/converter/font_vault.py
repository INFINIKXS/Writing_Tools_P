import json
import os
import re
import time
import shutil
import logging
import threading
import hashlib
from datetime import datetime
from pathlib import Path
import fitz
from .font_utils import cmap_set, root_family, canonical_family, family_match

logger = logging.getLogger(__name__)

def _default_vault_dir() -> Path:
    if os.getenv("FONT_VAULT_DIR"):
        return Path(os.getenv("FONT_VAULT_DIR"))
    local_app_data = os.getenv("LOCALAPPDATA")
    base_vault = Path(local_app_data) / "pdf_editor_font_vault" if local_app_data else Path.home() / ".cache" / "pdf_editor_font_vault"
    proj_vault = Path(__file__).resolve().parent.parent / "font_vault"
    if proj_vault.exists() and proj_vault.is_dir():
        try:
            base_vault.mkdir(parents=True, exist_ok=True)
            for sub in ["full", "buffers", "subsets", "manifest.json", "family_map.json", "aliases.json"]:
                src = proj_vault / sub
                dst = base_vault / sub
                if src.exists() and not dst.exists():
                    if src.is_dir():
                        shutil.copytree(src, dst, dirs_exist_ok=True)
                    else:
                        shutil.copy2(src, dst)
        except Exception:
            pass
    return base_vault

VAULT_DIR = _default_vault_dir()
_LOCK = threading.Lock()
_MCACHE = {"mtime": None, "data": {}, "dirty": False}
_CMAP_LRU = {}
_BATCH_DEPTH = threading.local()

class vault_batch_write:
    """Context manager to accumulate vault updates in memory and flush manifest.json once upon exit."""
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

def _find_entry(mf, family):
    fam = resolve_root_family(family)
    curr = fam
    for _ in range(2):
        for key, entry in mf.items():
            if family_match(key, curr):
                return entry
            if family_match(canonical_family(entry.get("stand_in_for") or ""), curr):
                return entry
        found_next = None
        for key, entry in mf.items():
            if family_match(key, curr) and entry.get("stand_in_for"):
                found_next = canonical_family(entry["stand_in_for"])
                break
        if found_next and found_next != curr:
            curr = found_next
        else:
            break
    return None

def vault_set_alias(alias_family, stand_in_for, style="regular"):
    """Register an alias mapping so that alias_family maps to stand_in_for."""
    with _LOCK:
        mf = _read_manifest()
        fam = canonical_family(alias_family)
        target_fam = canonical_family(stand_in_for)
        e = mf.setdefault(fam, {
            "coverage": [], "sources": [], "full_font": None,
            "stem_vw_ratio": None, "format": "otf", "license": "alias-pinning",
            "stand_in_for": target_fam, "style": style,
            "added_at": datetime.utcnow().isoformat()
        })
        e["stand_in_for"] = target_fam
        e["style"] = style
        if getattr(_BATCH_DEPTH, "val", 0) > 0:
            _MCACHE["dirty"] = True
            _MCACHE["data"] = mf
        else:
            _write_manifest(mf)

def _to_ranges(cs):
    out, s, p = [], None, None
    for cp in sorted(cs):
        if p is not None and cp == p + 1:
            p = cp
            continue
        if p is not None:
            out.append([s, p])
        s = p = cp
    if p is not None:
        out.append([s, p])
    return out

def _from_ranges(r):
    out = set()
    for item in (r or []):
        if isinstance(item, (list, tuple)) and len(item) == 2:
            out.update(range(item[0], item[1] + 1))
        elif isinstance(item, int):
            out.add(item)
    return out

def _read_manifest():
    p = VAULT_DIR / "manifest.json"
    try:
        mt = p.stat().st_mtime
        if _MCACHE["mtime"] != mt:
            data = json.loads(p.read_text())
            for fam, entry in data.items():
                if "license" not in entry:
                    entry["license"] = "document-embedded"
            _MCACHE.update(mtime=mt, data=data, dirty=False)
    except Exception:
        pass
    return _MCACHE["data"]

def _write_manifest(mf):
    p = VAULT_DIR / "manifest.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(f".tmp.{os.getpid()}")
    try:
        tmp.write_text(json.dumps(mf, indent=1))
        for attempt in range(3):
            try:
                os.replace(tmp, p)
                _MCACHE.update(mtime=p.stat().st_mtime, data=mf, dirty=False)
                return
            except OSError as err:
                if attempt == 2:
                    logger.warning(f"_write_manifest replace failed after 3 attempts: {err}")
                    if tmp.exists():
                        try: tmp.unlink()
                        except Exception: pass
                    return
                time.sleep(0.1 * (attempt + 1))
    except Exception as ex:
        logger.warning(f"_write_manifest failed: {ex}")
        if tmp.exists():
            try: tmp.unlink()
            except Exception: pass

def _cached_cmap(path):
    key = (str(path), path.stat().st_mtime)
    if key not in _CMAP_LRU:
        _CMAP_LRU[key] = cmap_set(path.read_bytes()) or set()
    return _CMAP_LRU[key]

def _font_id(buf: bytes) -> str:
    return hashlib.sha256(buf).hexdigest()[:16] if buf else ""

def vault_ingest(family, basename, buffer, *, stem_vw_ratio=None, fmt="otf",
                 license="document-embedded", full=False, stand_in_for=None, style=None,
                 is_subset=False):
    """Store a font buffer + union its coverage into the manifest. Cheap & idempotent."""
    try:
        fam = root_family(family)
        st = style if style else ("bold" if re.search(r"[-_](Bold|Bd)", basename, re.I) else "italic" if re.search(r"[-_](Italic|It|Oblique)", basename, re.I) else "regular")
        fam_key = f"{fam}_{st}"
        with _LOCK:
            (VAULT_DIR / "buffers").mkdir(parents=True, exist_ok=True)
            (VAULT_DIR / "full").mkdir(parents=True, exist_ok=True)
            (VAULT_DIR / "subsets").mkdir(parents=True, exist_ok=True)

            # Route: full fonts → full/, subsets → subsets/, buffers → buffers/
            if is_subset:
                rel = f"subsets/{basename}.{fmt}"
            elif full:
                rel = f"full/{basename}"
            else:
                rel = f"buffers/{basename}.{fmt}"
            dest = VAULT_DIR / rel
            if not dest.exists():
                dest.write_bytes(buffer)
            cov = cmap_set(buffer) or set()
            mf = _read_manifest()
            e = mf.setdefault(fam_key, {"coverage": [], "sources": [], "full_font": None,
                                        "subsets": [],
                                        "stem_vw_ratio": None, "format": fmt,
                                        "license": license, "stand_in_for": stand_in_for, "style": st,
                                        "added_at": datetime.utcnow().isoformat()})
            if "subsets" not in e:
                e["subsets"] = []
            e["coverage"] = _to_ranges(_from_ranges(e["coverage"]) | cov)
            e["buffer_id"] = _font_id(buffer)
            e["style"] = st
            if is_subset:
                # Subsets go to a separate list; never used for promotion
                if basename not in e["subsets"]:
                    e["subsets"].append(basename)
            elif full:
                e["full_font"] = rel
            elif basename not in e["sources"]:
                e["sources"].append(basename)

            if stem_vw_ratio and not e.get("stem_vw_ratio"):
                e["stem_vw_ratio"] = stem_vw_ratio
            if stand_in_for and not e.get("stand_in_for"):
                e["stand_in_for"] = stand_in_for
            if license and not e.get("license"):
                e["license"] = license

            if getattr(_BATCH_DEPTH, "val", 0) > 0:
                _MCACHE["dirty"] = True
                _MCACHE["data"] = mf
            else:
                _write_manifest(mf)
    except Exception as ex:
        logger.warning(f"vault_ingest failed ({basename}): {ex}")

def vault_ingest_batch(items):
    """Batch ingest multiple font tuples: (family, basename, buffer, kwargs). Flushes manifest once."""
    with vault_batch_write():
        for item in items:
            family = item[0]
            basename = item[1]
            buffer = item[2]
            kwargs = item[3] if len(item) > 3 else {}
            vault_ingest(family, basename, buffer, **kwargs)

def _pdf_safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_+\-]", "-", name)

def vault_cover_for(family, ch):
    """(name, buffer) of a vault font in the same family covering ch, else None.
    Preference: registered full font → stored subsets (newest coverage first)."""
    e = _find_entry(_read_manifest(), family)
    if not e or ord(ch) not in _from_ranges(e["coverage"]):
        return None
    candidates = []
    if e.get("full_font"):
        candidates.append(VAULT_DIR / e["full_font"])
    
    # Subsets: check .otf and format extension in both buffers/ and subsets/
    subset_paths = []
    for s in (e.get("sources", []) + e.get("subsets", [])):
        for sub_dir in ("buffers", "subsets"):
            p_otf = VAULT_DIR / sub_dir / f"{s}.otf"
            p_fmt = VAULT_DIR / sub_dir / f"{s}.{e.get('format', 'otf')}"
            if p_otf.exists() and p_otf not in subset_paths:
                subset_paths.append(p_otf)
            if p_fmt.exists() and p_fmt not in subset_paths:
                subset_paths.append(p_fmt)

    candidates += sorted(subset_paths, key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
    
    for p in candidates:
        if p.exists() and ord(ch) in _cached_cmap(p):
            return (_pdf_safe(p.stem), p.read_bytes())
    return None

def vault_full_for(family, style="regular"):
    """Return a full-charset font buffer for promotion. NEVER returns subset buffers."""
    mf = _read_manifest()
    fam = resolve_root_family(family)
    
    # 1. Exact family + style match
    for key, entry in mf.items():
        if resolve_root_family(key) == fam or resolve_root_family(entry.get("stand_in_for", "")) == fam:
            # Style-aware selection (prefer exact style, then regular)
            if entry.get("style", "regular") == style and entry.get("full_font"):
                p = VAULT_DIR / entry["full_font"]
                if p.exists() and "subsets/" not in str(p):
                    return (_pdf_safe(p.stem), p.read_bytes())
                
    # 2. Fallback to "regular" if requested style missing
    if style != "regular":
        for key, entry in mf.items():
            if resolve_root_family(key) == fam or resolve_root_family(entry.get("stand_in_for", "")) == fam:
                if entry.get("style", "regular") == "regular" and entry.get("full_font"):
                    p = VAULT_DIR / entry["full_font"]
                    if p.exists() and "subsets/" not in str(p):
                        return (_pdf_safe(p.stem), p.read_bytes())
                    
    # 3. Any variant as last resort
    for key, entry in mf.items():
        if resolve_root_family(key) == fam or resolve_root_family(entry.get("stand_in_for", "")) == fam:
            if entry.get("full_font"):
                p = VAULT_DIR / entry["full_font"]
                if p.exists() and "subsets/" not in str(p):
                    return (_pdf_safe(p.stem), p.read_bytes())
                
    return None

def vault_list():
    return _read_manifest()

def _atomic_write_json(path, obj):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj, indent=1))
    os.replace(tmp, path)

def register_static_family(root_fam, style, rel_path, alias=None):
    """Called ONLY by fetch_fonts.py / ingest_system_font.py. Never by bakes."""
    with _LOCK:
        fm_path = VAULT_DIR / "family_map.json"
        fm = json.loads(fm_path.read_text()) if fm_path.exists() else {}
        fm.setdefault(root_family(root_fam), {}).setdefault(style, rel_path)
        _atomic_write_json(fm_path, fm)
        if alias:
            al_path = VAULT_DIR / "aliases.json"
            al = json.loads(al_path.read_text()) if al_path.exists() else {}
            al[canonical_family(alias)] = root_family(root_fam)
            _atomic_write_json(al_path, al)

def resolve_root_family(family):
    """Follow alias lines to the root family (max 3 hops, cycle-safe)."""
    al_path = VAULT_DIR / "aliases.json"
    al = json.loads(al_path.read_text()) if al_path.exists() else {}
    fam = canonical_family(family)
    for _ in range(3):
        nxt = al.get(fam)
        if not nxt or canonical_family(nxt) == fam:
            break
        fam = canonical_family(nxt)
    return fam

def resolve_promotion_target(family, style="regular"):
    """Static-table lookup: root family + style -> (name, buffer, root). None if unknown."""
    root = resolve_root_family(family)
    fm_path = VAULT_DIR / "family_map.json"
    fm = json.loads(fm_path.read_text()) if fm_path.exists() else {}
    entry = fm.get(root)
    if not entry:
        return None
    rel = entry.get(style) or entry.get("regular")
    if not rel:
        return None
    p = VAULT_DIR / rel
    if p.exists():
        return (_pdf_safe(p.stem), p.read_bytes(), root)
    return None


