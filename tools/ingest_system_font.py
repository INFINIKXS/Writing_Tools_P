import sys
import os
import shutil
import glob
import re
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from converter.font_vault import vault_ingest, VAULT_DIR, root_family, register_static_family

# Mapping: (filename_glob, stand_in_for_family, license_note)
WINDOWS_FONT_MAP = [
    ("arial*.ttf", "Arial", "Microsoft EULA (Local Install)"),
    ("times*.ttf", "Times New Roman", "Microsoft EULA"),
    ("cour*.ttf", "Courier New", "Microsoft EULA"),
    ("calibri*.ttf", "Calibri", "Microsoft EULA"),
    ("cambria*.ttf", "Cambria", "Microsoft EULA"),
    ("georgia*.ttf", "Georgia", "Microsoft EULA"),
    ("verdana*.ttf", "Verdana", "Microsoft EULA"),
    ("trebuc*.ttf", "Trebuchet MS", "Microsoft EULA"),
    ("pala*.ttf", "Palatino / Book Antiqua", "Microsoft EULA"),
    ("bookos*.ttf", "Bookman Old Style", "Microsoft EULA"),
    ("segoeui*.ttf", "Segoe UI", "Microsoft EULA"),
    ("tahoma*.ttf", "Tahoma", "Microsoft EULA"),
    ("consola*.ttf", "Consolas", "Microsoft EULA"),
    ("symbol.ttf", "Symbol", "Microsoft EULA"),
    ("wingding*.ttf", "Wingdings", "Microsoft EULA"),
]

def parse_windows_font_style(filename: str) -> str:
    fn = Path(filename).stem.lower()
    if any(fn.endswith(s) for s in ("bi", "z", "bolditalic", "bdit", "bdi")) or ("bold" in fn and "italic" in fn):
        return "bolditalic"
    if any(fn.endswith(s) for s in ("bd", "b", "bold")) or ("bold" in fn):
        return "bold"
    if any(fn.endswith(s) for s in ("i", "italic", "oblique", "it")) or ("italic" in fn):
        return "italic"
    return "regular"

def get_search_dirs():
    dirs = []
    # 1. System Fonts
    win_fonts = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
    if win_fonts.exists():
        dirs.append(win_fonts)
        
    # 2. User-installed Fonts
    user_fonts = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Windows" / "Fonts"
    if user_fonts.exists():
        dirs.append(user_fonts)
        
    # 3. Microsoft Office Virtual File System (VFS) Fonts
    for prog_files in [os.environ.get("ProgramFiles", r"C:\Program Files"), 
                       os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")]:
        if prog_files:
            # Modern Office (Click-to-Run)
            office_dirs = glob.glob(os.path.join(prog_files, "Microsoft Office", "root", "vfs", "Fonts", "**"), recursive=True)
            for d in office_dirs:
                if os.path.exists(d): dirs.append(Path(d))
            # Older Office (MSI)
            office_dirs_old = glob.glob(os.path.join(prog_files, "Microsoft Office", "**", "Fonts"), recursive=True)
            for d in office_dirs_old:
                if os.path.exists(d): dirs.append(Path(d))
                    
    return dirs

def ingest_system_fonts():
    print("[SCAN] Searching for Windows and Office fonts...")
    search_dirs = get_search_dirs()
    
    if not search_dirs:
        print("[ERROR] Could not find any Windows font directories.")
        return
        
    for d in search_dirs:
        print(f"  -> {d}")
        
    full_dir = VAULT_DIR / "full"
    full_dir.mkdir(parents=True, exist_ok=True)
    
    ingested_count = 0
    
    for pattern, stand_in, license_note in WINDOWS_FONT_MAP:
        found_files = []
        for d in search_dirs:
            found_files.extend(d.glob(pattern))
            found_files.extend(d.glob(pattern.upper()))
            
        # Deduplicate by filename
        unique_files = {f.name.lower(): f for f in found_files if f.is_file()}
        
        for fname_lower, src_path in unique_files.items():
            dest_path = full_dir / src_path.name
            style = parse_windows_font_style(src_path.name)
            root = root_family(stand_in.split("/")[0])
            own_family_name = stand_in.split("/")[0]
            
            if dest_path.exists():
                buf = dest_path.read_bytes()
                ext = "otf" if src_path.suffix.lower() == ".otf" else "ttf"
                vault_ingest(stand_in, src_path.name, buf, fmt=ext, 
                             license=license_note, full=True, stand_in_for=stand_in, style=style)
                register_static_family(root, style, f"full/{src_path.name}", alias=own_family_name)
                print(f"  [SKIP/INGEST] {src_path.name} -> {stand_in} ({style})")
                continue
                
            try:
                # Copy from Windows to Vault
                shutil.copy2(src_path, dest_path)
                buf = dest_path.read_bytes()
                ext = "otf" if src_path.suffix.lower() == ".otf" else "ttf"
                
                # Ingest into vault
                vault_ingest(stand_in, src_path.name, buf, fmt=ext, 
                             license=license_note, full=True, stand_in_for=stand_in, style=style)
                register_static_family(root, style, f"full/{src_path.name}", alias=own_family_name)
                
                print(f"  [OK] Copied {src_path.name} -> {stand_in} ({style})")
                ingested_count += 1
            except Exception as e:
                print(f"  [FAIL] {src_path.name}: {e}")
                
    print(f"\n[DONE] Ingested {ingested_count} new system fonts into the vault.")

if __name__ == "__main__":
    ingest_system_fonts()
