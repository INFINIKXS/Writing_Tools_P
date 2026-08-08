import sys
import json
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from converter.font_vault import VAULT_DIR, resolve_promotion_target, vault_full_for

def update_tables():
    proj_vault = Path(__file__).resolve().parent.parent / "backend" / "font_vault"
    target_rel = "full/New Baskerville ITC W04 Roman.ttf"

    for vdir in [VAULT_DIR, proj_vault]:
        fm_p = vdir / "family_map.json"
        if fm_p.exists():
            fm = json.loads(fm_p.read_text())
            fm.setdefault("newbaskerville", {})["regular"] = target_rel
            fm_p.write_text(json.dumps(fm, indent=1))
            print(f"Updated {fm_p}")

        mf_p = vdir / "manifest.json"
        if mf_p.exists():
            mf = json.loads(mf_p.read_text())
            if "newbaskerville_regular" in mf:
                mf["newbaskerville_regular"]["full_font"] = target_rel
                mf_p.write_text(json.dumps(mf, indent=1))
                print(f"Updated {mf_p}")

    # Verify resolution targets
    res = resolve_promotion_target("NewBaskerville-Roman", style="regular")
    v_full = vault_full_for("NewBaskerville-Roman", style="regular")

    print("\n--- VERIFICATION RESULTS ---")
    print(f"[resolve_promotion_target]: {res[0] if res else None}")
    print(f"[vault_full_for]:           {v_full[0] if v_full else None}")

    assert res[0] == "New-Baskerville-ITC-W04-Roman", f"Unexpected name: {res[0]}"
    assert v_full[0] == "New-Baskerville-ITC-W04-Roman", f"Unexpected name: {v_full[0]}"
    print("\n[SUCCESS] Sanitize + table mapping verified perfectly!")

if __name__ == "__main__":
    update_tables()
