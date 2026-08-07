import sys
import os
import io
import ssl
import json
import zipfile
import urllib.request
import urllib.error
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from fontTools.ttLib import TTFont
from converter.font_vault import vault_ingest, VAULT_DIR, root_family, register_static_family

def load_env_file():
    """Load environment variables from backend/.env or .env if present."""
    env_paths = [
        Path(__file__).resolve().parent.parent / "backend" / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]
    for p in env_paths:
        if p.exists():
            try:
                lines = p.read_text(encoding="utf-8").splitlines()
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip("'\"")
                        if key and key not in os.environ:
                            os.environ[key] = val
            except Exception:
                pass

# ── Phase 1: Static Manual URLs ─────────────────────────────────────────────
STATIC_FONTS = [
    # (save-name, urls, license, stand_in_for, style)
    ("libre-baskerville-Regular.ttf", [
        "https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-400-normal.ttf"
    ], "SIL OFL 1.1", "NewBaskerville-Roman", "regular"),
    ("libre-baskerville-Bold.ttf", [
        "https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-700-normal.ttf"
    ], "SIL OFL 1.1", "NewBaskerville-Bold", "bold"),
    ("libre-baskerville-Italic.ttf", [
        "https://cdn.jsdelivr.net/fontsource/fonts/libre-baskerville@latest/latin-400-italic.ttf"
    ], "SIL OFL 1.1", "NewBaskerville-Italic", "italic"),
]

# ── Phase 2: CTAN TeX Gyre (Metric-Compatible Clones) ────────────────────────
CTAN_ZIP_URL = "https://mirrors.ctan.org/fonts/tex-gyre.zip"
TEX_GYRE_MAPPINGS = {
    "texgyreheros": ("Helvetica / HelveticaNeueLTStd", "regular"),
    "texgyreheros-bold": ("Helvetica / HelveticaNeueLTStd", "bold"),
    "texgyreheros-italic": ("Helvetica / HelveticaNeueLTStd", "italic"),
    "texgyreheros-bolditalic": ("Helvetica / HelveticaNeueLTStd", "bolditalic"),
    "texgyretermes": ("Times New Roman / BookAntiqua", "regular"),
    "texgyretermes-bold": ("Times New Roman / BookAntiqua", "bold"),
    "texgyretermes-italic": ("Times New Roman / BookAntiqua", "italic"),
    "texgyrepagella": ("Palatino / BookAntiqua", "regular"),
    "texgyrepagella-bold": ("Palatino / BookAntiqua", "bold"),
    "texgyrecursor": ("Courier / Courier New", "regular"),
    "texgyrecursor-bold": ("Courier / Courier New", "bold"),
}

# ── Phase 3: Google Fonts API (Curated Workhorses) ───────────────────────────
# We don't download all 1500+ fonts. We target metric-compatible workhorses 
# and massive-coverage fallbacks (Noto).
GOOGLE_FONTS_MAP = [
    # (Google Family Name, stand_in_for commercial font)
    ("Arimo", "Arial"),
    ("Tinos", "Times New Roman"),
    ("Cousine", "Courier New"),
    ("Carlito", "Calibri"),
    ("Caladea", "Cambria"),
    ("Roboto", "Helvetica Neue"),
    ("Open Sans", "Helvetica"),
    ("Lato", "Helvetica"),
    ("Source Sans 3", "Helvetica"),
    ("Source Serif 4", "Times New Roman"),
    ("EB Garamond", "Garamond"),
    ("Merriweather", "Georgia"),
    ("Noto Sans", "Arial"),      # Ultimate Unicode fallback
    ("Noto Serif", "Times New Roman"), # Ultimate Unicode fallback
]

def parse_style_from_variant(variant_key):
    v = variant_key.lower()
    is_bold = "700" in v or "800" in v or "900" in v or "bold" in v
    is_italic = "italic" in v
    if is_bold and is_italic: return "bolditalic"
    if is_bold: return "bold"
    if is_italic: return "italic"
    return "regular"

def download_file(url, dest_path, ctx):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            dest_path.write_bytes(resp.read())
            return True
    except Exception as e:
        print(f"  [WARN] Download failed ({url}): {e}")
        return False

def fetch_static(ctx):
    print("\n[PHASE 1] Fetching Static Manual Fonts...")
    full_dir = VAULT_DIR / "full"
    for save_name, urls, lic, stand_in, style in STATIC_FONTS:
        dest = full_dir / save_name
        root = root_family(stand_in.split("/")[0])
        own_family_name = "Libre Baskerville"
        if dest.exists():
            buf = dest.read_bytes()
            fmt = "otf" if save_name.endswith(".otf") else "ttf"
            vault_ingest(stand_in, save_name, buf, fmt=fmt, license=lic, 
                         full=True, stand_in_for=stand_in, style=style)
            register_static_family(root, style, f"full/{save_name}", alias=own_family_name)
            print(f"  [SKIP/REGISTER] {save_name}")
            continue
        for url in urls:
            if download_file(url, dest, ctx):
                buf = dest.read_bytes()
                fmt = "otf" if save_name.endswith(".otf") else "ttf"
                vault_ingest(stand_in, save_name, buf, fmt=fmt, license=lic, 
                             full=True, stand_in_for=stand_in, style=style)
                register_static_family(root, style, f"full/{save_name}", alias=own_family_name)
                print(f"  [OK] {save_name} ({style})")
                break

def fetch_ctan(ctx):
    print("\n[PHASE 2] Fetching TeX Gyre from CTAN...")
    temp_dir = VAULT_DIR / "_ctan_temp"
    temp_dir.mkdir(exist_ok=True)
    zip_path = temp_dir / "texgyre.zip"
    
    if not download_file(CTAN_ZIP_URL, zip_path, ctx):
        print("  [FAIL] Could not download CTAN zip.")
        return
        
    try:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(temp_dir)
    except Exception as e:
        print(f"  [FAIL] Zip extraction failed: {e}")
        return

    full_dir = VAULT_DIR / "full"
    for otf_path in temp_dir.rglob("*.otf"):
        name = otf_path.stem.lower()
        if name in TEX_GYRE_MAPPINGS:
            stand_in, style = TEX_GYRE_MAPPINGS[name]
            dest = full_dir / otf_path.name
            if not dest.exists():
                dest.write_bytes(otf_path.read_bytes())
            buf = dest.read_bytes()
            vault_ingest(stand_in, otf_path.name, buf, fmt="otf", 
                         license="GUST Font License", full=True, 
                         stand_in_for=stand_in, style=style)
            root = root_family(stand_in.split("/")[0])
            own_family_name = name.split("-")[0]
            register_static_family(root, style, f"full/{otf_path.name}", alias=own_family_name)
            print(f"  [OK] {otf_path.name} -> {stand_in} ({style})")
            
    shutil.rmtree(temp_dir, ignore_errors=True)

def fetch_google_api(api_key, ctx):
    print("\n[PHASE 3] Fetching Google Fonts via API...")
    if not api_key:
        print("  [SKIP] No GOOGLE_FONT_API_KEY / GOOGLE_FONTS_API_KEY provided.")
        return
        
    url = f"https://www.googleapis.com/webfonts/v1/webfonts?key={api_key}&sort=popularity"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [FAIL] API request failed: {e}")
        return

    api_families = {item["family"]: item for item in data.get("items", [])}
    full_dir = VAULT_DIR / "full"
    
    for gf_family, stand_in in GOOGLE_FONTS_MAP:
        if gf_family not in api_families:
            print(f"  [WARN] {gf_family} not found in API response.")
            continue
            
        files = api_families[gf_family].get("files", {})
        for variant_key, file_url in files.items():
            style = parse_style_from_variant(variant_key)
            # Only fetch core weights to save space/time
            if style not in ("regular", "bold", "italic", "bolditalic"):
                continue
                
            ext = "ttf" if file_url.endswith(".ttf") else "otf"
            save_name = f"{gf_family.replace(' ', '')}-{variant_key}.{ext}"
            dest = full_dir / save_name
            root = root_family(stand_in.split("/")[0])
            
            if dest.exists():
                buf = dest.read_bytes()
                vault_ingest(stand_in, save_name, buf, fmt=ext, 
                             license="SIL OFL 1.1", full=True, 
                             stand_in_for=stand_in, style=style)
                register_static_family(root, style, f"full/{save_name}", alias=gf_family)
                print(f"  [SKIP/REGISTER] {save_name}")
                continue
                
            if download_file(file_url, dest, ctx):
                buf = dest.read_bytes()
                # Verify it's a valid font
                try:
                    tt = TTFont(io.BytesIO(buf))
                    tt.close()
                    vault_ingest(stand_in, save_name, buf, fmt=ext, 
                                 license="SIL OFL 1.1", full=True, 
                                 stand_in_for=stand_in, style=style)
                    register_static_family(root, style, f"full/{save_name}", alias=gf_family)
                    print(f"  [OK] {save_name} -> {stand_in} ({style})")
                except Exception:
                    dest.unlink(missing_ok=True)

if __name__ == "__main__":
    load_env_file()
    api_key = os.getenv("GOOGLE_FONT_API_KEY") or os.getenv("GOOGLE_FONTS_API_KEY")
    if "--api-key" in sys.argv:
        idx = sys.argv.index("--api-key")
        if idx + 1 < len(sys.argv):
            api_key = sys.argv[idx + 1]

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    fetch_static(ctx)
    fetch_ctan(ctx)
    fetch_google_api(api_key, ctx)
    
    print("\n[DONE] Vault rebuild complete.")
