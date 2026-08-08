import sys
import shutil
import json
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fontTools.ttLib import TTFont
import fitz
from converter.font_vault import vault_ingest, register_static_family, root_family, VAULT_DIR, resolve_promotion_target

TARGET_DIRS = [
    Path(r"C:\Users\Paradox-Labs\Downloads\new-baskerville-roman"),
    Path(r"C:\Users\Paradox-Labs\Downloads\OnlineWebFonts_COM_ca9dfb1ad44b59f800ef2a046cb22ec1")
]

def parse_font_style(name_str: str) -> str:
    s = name_str.lower()
    if "bold" in s and "italic" in s:
        return "bolditalic"
    if "bold" in s or "bd" in s:
        return "bold"
    if "italic" in s or "it" in s or "oblique" in s:
        return "italic"
    return "regular"

def ingest_custom_fonts():
    print("[INGEST] Scanning custom font download directories...")
    font_files = []
    for d in TARGET_DIRS:
        if d.exists():
            for p in d.rglob("*"):
                if p.is_file() and p.suffix.lower() in (".ttf", ".otf"):
                    font_files.append(p)

    if not font_files:
        print("[WARNING] No .ttf or .otf files found in target directories.")
        return

    print(f"Found {len(font_files)} custom font file(s):")
    for fpath in font_files:
        print(f"  -> {fpath}")

    proj_vault = Path(__file__).resolve().parent.parent / "backend" / "font_vault"
    (proj_vault / "full").mkdir(parents=True, exist_ok=True)

    ingested_count = 0
    for fpath in font_files:
        try:
            buf = fpath.read_bytes()
            font = fitz.Font(fontbuffer=buf)
            tt = TTFont(fpath)
            
            name = font.name or fpath.stem
            glyph_count = font.glyph_count
            upm = tt["head"].unitsPerEm if "head" in tt else 1000
            fmt = fpath.suffix.lower().replace(".", "")
            style = parse_font_style(fpath.name)
            
            print(f"\nProcessing '{fpath.name}':")
            print(f"  - Font Name: {name}")
            print(f"  - Format: {fmt.upper()}")
            print(f"  - Glyphs: {glyph_count}")
            print(f"  - UnitsPerEm: {upm}")
            print(f"  - Detected Style: {style}")

            # Stand-in target is NewBaskerville-Roman
            stand_in = "NewBaskerville-Roman"
            vault_ingest(stand_in, fpath.name, buf, fmt=fmt,
                         license="User Download", full=True, stand_in_for=stand_in, style=style)

            root = root_family(stand_in)
            register_static_family(root, style, f"full/{fpath.name}", alias="New Baskerville Roman")
            register_static_family(root, style, f"full/{fpath.name}", alias="New Baskerville ITC W04 Roman")

            # Copy specifically to backend/font_vault/full/
            shutil.copy2(fpath, proj_vault / "full" / fpath.name)

            ingested_count += 1
            print(f"  [OK] Ingested and registered {fpath.name} into vault!")
        except Exception as e:
            print(f"  [FAIL] {fpath.name}: {e}")

    # Copy updated manifest and registries to backend/font_vault
    for meta_file in ["manifest.json", "family_map.json", "aliases.json"]:
        if (VAULT_DIR / meta_file).exists():
            shutil.copy2(VAULT_DIR / meta_file, proj_vault / meta_file)

    # Test resolution
    target = resolve_promotion_target("NewBaskerville-Roman", style="regular")
    if target:
        name, buf_res, root_res = target
        print(f"\n[VERIFIED PROMOTION TARGET] {name} (Root: {root_res}, Size: {len(buf_res)} bytes)")

    print(f"\n[DONE] Ingested {ingested_count} custom font(s) into the vault.")

if __name__ == "__main__":
    ingest_custom_fonts()
