import shutil
import stat
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from converter.font_vault import VAULT_DIR

def remove_readonly(func, path, excinfo):
    """Error handler for shutil.rmtree to handle Windows read-only files."""
    import os
    os.chmod(path, stat.S_IWRITE)
    func(path)

def wipe_vault():
    proj_vault = Path(__file__).resolve().parent.parent / "backend" / "font_vault"
    print(f"[WIPE] Targeting vault at: {VAULT_DIR}")
    if proj_vault.exists():
        print(f"[WIPE] Also targeting project vault at: {proj_vault}")

    vault_dirs = [VAULT_DIR]
    if proj_vault.exists() and proj_vault.resolve() != VAULT_DIR.resolve():
        vault_dirs.append(proj_vault)

    for v_dir in vault_dirs:
        targets = [
            v_dir / "manifest.json",
            v_dir / "full",
            v_dir / "buffers",
            v_dir / "_ctan_temp"
        ]
        
        for target in targets:
            if target.exists():
                print(f"  Deleting {target}")
                if target.is_dir():
                    shutil.rmtree(target, onerror=remove_readonly)
                else:
                    target.unlink()
            else:
                print(f"  Skip {target.name} (not found)")
                
        # Recreate empty directories
        (v_dir / "full").mkdir(parents=True, exist_ok=True)
        (v_dir / "buffers").mkdir(parents=True, exist_ok=True)
    
    print("[WIPE] Complete. Vault is clean.")

if __name__ == "__main__":
    wipe_vault()
