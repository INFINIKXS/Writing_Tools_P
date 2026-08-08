import sys
import shutil
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from fontTools.ttLib import TTFont
import fitz
from converter.font_vault import vault_ingest, register_static_family, root_family, VAULT_DIR, resolve_promotion_target

FONTS_TO_INGEST = [
    Path(r"C:\Users\Paradox-Labs\Downloads\new-baskerville-roman\New Baskerville Roman\New Baskerville Roman.otf"),
    Path(r"C:\Users\Paradox-Labs\Downloads\OnlineWebFonts_COM_ca9dfb1ad44b59f800ef2a046cb22ec1\New Baskerville ITC W04 Roman\New Baskerville ITC W04 Roman.ttf"),
    Path(r"C:\Users\Paradox-Labs\Downloads\OnlineWebFonts_COM_ca9dfb1ad44b59f800ef2a046cb22ec1\New Baskerville ITC W04 Roman\New Baskerville ITC W04 Roman.otf")
]

def main():
    print("[HARVESTER] Ingesting downloaded New Baskerville fonts into vault...")
    proj_vault = Path(__file__).resolve().parent.parent / "backend" / "font_vault"
    (proj_vault / "full").mkdir(parents=True, exist_ok=True)

    ingested = 0
    for font_path in FONTS_TO_INGEST:
        if not font_path.exists():
            print(f"  [MISSING] {font_path.name}")
            continue

        try:
            buf = font_path.read_bytes()
            font = fitz.Font(fontbuffer=buf)
            tt = TTFont(font_path)
            
            fmt = font_path.suffix.lower().replace(".", "")
            stand_in = "NewBaskerville-Roman"
            
            print(f"\nProcessing '{font_path.name}':")
            print(f"  - Font Name: {font.name or font_path.stem}")
            print(f"  - Format: {fmt.upper()}")
            print(f"  - Glyphs: {font.glyph_count}")
            print(f"  - UPM: {tt['head'].unitsPerEm if 'head' in tt else 1000}")

            # 1. Ingest into vault
            vault_ingest(stand_in, font_path.name, buf, fmt=fmt, license="User Download", full=True, stand_in_for=stand_in, style="regular")

            # 2. Register in static family map & aliases
            root = root_family(stand_in)
            alias_name = font_path.stem
            register_static_family(root, "regular", f"full/{font_path.name}", alias=alias_name)
            register_static_family(root, "regular", f"full/{font_path.name}", alias="New Baskerville Roman")
            register_static_family(root, "regular", f"full/{font_path.name}", alias="New Baskerville ITC W04 Roman")

            # 3. Copy to project backend/font_vault/full/
            shutil.copy2(font_path, proj_vault / "full" / font_path.name)
            ingested += 1
            print(f"  [SUCCESS] Ingested and registered {font_path.name}!")
        except Exception as e:
            print(f"  [ERROR] Failed to ingest {font_path.name}: {e}")

    # Copy updated manifest and registry metadata files
    for meta in ["manifest.json", "family_map.json", "aliases.json"]:
        if (VAULT_DIR / meta).exists():
            shutil.copy2(VAULT_DIR / meta, proj_vault / meta)

    # Test resolution
    target = resolve_promotion_target("NewBaskerville-Roman", style="regular")
    if target:
        name, buf_res, root_res = target
        print(f"\n[VERIFIED PROMOTION TARGET] {name} (Root: {root_res}, Size: {len(buf_res)} bytes)")

    print(f"\n[DONE] Successfully ingested {ingested} font file(s) into vault.")

if __name__ == "__main__":
    main()
